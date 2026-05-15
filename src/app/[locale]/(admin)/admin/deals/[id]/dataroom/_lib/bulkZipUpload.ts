import {
  BlobReader,
  BlobWriter,
  ZipReader,
  configure,
  type Entry,
} from '@zip.js/zip.js';
import * as tus from 'tus-js-client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeStorageName } from './uploadToFolder';
import { maybeCompressImage } from '@/lib/utils/imageCompression';

// Run zip.js decompression in a Web Worker to keep the UI thread responsive
// during long extractions. The library bundles its workers but we still need
// to opt in.
configure({ useWebWorkers: true });

// Standard Supabase POST upload silently caps single-request payloads around
// 50 MB on the API gateway. For files larger than this we switch to the
// resumable (TUS) endpoint, which also gives us pause/resume across network
// blips. 6 MB is Supabase's recommended cutoff but we use 50 MB because
// individual TUS uploads carry per-request overhead and most files are tiny.
const TUS_THRESHOLD_BYTES = 50 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 4;

// Files inside Supabase Storage can't exceed the bucket's file_size_limit. The
// bucket is currently configured for 1 GB — entries above this will be
// rejected by storage anyway, so we flag them upfront instead of failing
// midway through a long upload.
const BUCKET_FILE_SIZE_LIMIT = 1024 * 1024 * 1024;

// Per-file retry policy for transient upload failures (504, 503, network
// blips, etc.). MAX_UPLOAD_ATTEMPTS = 3 means initial try + 2 retries.
// Backoff is exponential off RETRY_BASE_DELAY_MS. Non-transient errors
// (4xx, validation) fail fast without retry.
const MAX_UPLOAD_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1500;

const JUNK_EXACT = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

export interface BulkUploadProgress {
  phase: 'reading' | 'creating-folders' | 'uploading' | 'done' | 'error' | 'cancelled';
  message: string;
  currentFile: string | null;
  filesCompleted: number;
  filesTotal: number;
  filesSkipped: number;
  bytesUploaded: number;
  bytesTotal: number;
  errors: string[];
}

export interface BulkUploadResult {
  uploadedNames: string[];
  skippedCount: number;
  folderCount: number;
  errors: string[];
  cancelled: boolean;
}

export interface BulkUploadOptions {
  dealId: string;
  userId: string | null;
  zipFile: File;
  supabase: SupabaseClient;
  onProgress: (p: BulkUploadProgress) => void;
  signal?: AbortSignal;
}

// Public entry point. Returns a result summary suitable for the toast / notify.
export async function bulkZipUpload(opts: BulkUploadOptions): Promise<BulkUploadResult> {
  const { dealId, userId, zipFile, supabase, onProgress, signal } = opts;
  const errors: string[] = [];
  const uploadedNames: string[] = [];
  let filesSkipped = 0;

  const progress: BulkUploadProgress = {
    phase: 'reading',
    message: 'Reading ZIP…',
    currentFile: null,
    filesCompleted: 0,
    filesTotal: 0,
    filesSkipped: 0,
    bytesUploaded: 0,
    bytesTotal: 0,
    errors,
  };
  onProgress({ ...progress });

  // ── 1. Read ZIP entries ─────────────────────────────────────────────────
  const reader = new ZipReader(new BlobReader(zipFile));
  let allEntries: Entry[];
  try {
    allEntries = await reader.getEntries();
  } catch (e) {
    progress.phase = 'error';
    progress.message = `Could not read ZIP: ${e instanceof Error ? e.message : String(e)}`;
    onProgress({ ...progress });
    await reader.close();
    return { uploadedNames, skippedCount: 0, folderCount: 0, errors: [progress.message], cancelled: false };
  }

  // Filter junk + directories. We keep only file entries — folders are inferred
  // from their paths so we don't create empty junk folders.
  const fileEntries = allEntries.filter((entry) => {
    if (entry.directory) return false;
    const name = entry.filename;
    if (!name) return false;
    if (name.includes('__MACOSX/')) return false;
    const segs = name.split('/');
    const last = segs[segs.length - 1];
    if (!last) return false; // trailing slash
    if (JUNK_EXACT.has(last)) return false;
    return true;
  });

  if (fileEntries.length === 0) {
    progress.phase = 'error';
    progress.message = 'ZIP contained no files after filtering junk.';
    onProgress({ ...progress });
    await reader.close();
    return { uploadedNames, skippedCount: 0, folderCount: 0, errors: [progress.message], cancelled: false };
  }

  // ── 2. Detect single-folder wrapper that mirrors the zip name ───────────
  // If every entry shares the same first path segment AND that segment matches
  // the zip filename (case-insensitive, without .zip), strip it so the wrapper
  // doesn't pollute the root.
  const firstSegs = new Set<string>();
  for (const e of fileEntries) firstSegs.add(e.filename.split('/')[0]);
  let wrapper: string | null = null;
  if (firstSegs.size === 1) {
    const only = [...firstSegs][0];
    const zipBase = zipFile.name.replace(/\.zip$/i, '').trim().toLowerCase();
    if (only && only.trim().toLowerCase() === zipBase) wrapper = only;
  }

  // ── 3. Build entry records with normalized paths ────────────────────────
  type FileRecord = {
    entry: Entry;
    folderPath: string; // "" means deal root (shouldn't happen if user wants folders)
    fileName: string;   // display + storage source name
    size: number;
  };

  const files: FileRecord[] = [];
  const folderPathsSet = new Set<string>();
  let bytesTotal = 0;
  let oversizedCount = 0;

  for (const entry of fileEntries) {
    let p = entry.filename;
    if (wrapper) p = p.slice(wrapper.length + 1); // strip "wrapper/"
    p = p.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!p) continue;
    if (p.split('/').some((seg) => seg === '..' || seg === '.')) continue;

    const segs = p.split('/');
    const fileName = segs.pop()!;
    if (!fileName) continue;
    const folderPath = segs.join('/');
    const size = entry.uncompressedSize ?? 0;

    if (size > BUCKET_FILE_SIZE_LIMIT) {
      oversizedCount++;
      errors.push(`${fileName}: exceeds 1 GB bucket limit (${formatBytes(size)})`);
      continue;
    }

    files.push({ entry, folderPath, fileName, size });
    if (folderPath) folderPathsSet.add(folderPath);
    bytesTotal += size;
  }

  if (files.length === 0) {
    progress.phase = 'error';
    progress.message = oversizedCount > 0
      ? 'All files exceed the 1 GB bucket limit.'
      : 'No usable files in ZIP.';
    onProgress({ ...progress });
    await reader.close();
    return { uploadedNames, skippedCount: 0, folderCount: 0, errors, cancelled: false };
  }

  progress.filesTotal = files.length;
  progress.bytesTotal = bytesTotal;

  if (signal?.aborted) return cancel(progress, onProgress, reader, uploadedNames, errors);

  // ── 4. Resolve / create folders in one server call ──────────────────────
  progress.phase = 'creating-folders';
  progress.message = `Creating ${folderPathsSet.size} folder${folderPathsSet.size === 1 ? '' : 's'}…`;
  onProgress({ ...progress });

  let pathToId: Record<string, string>;
  try {
    const res = await fetch('/api/dataroom/folders/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: dealId, paths: [...folderPathsSet] }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `Folder bulk failed (${res.status})`);
    pathToId = body.pathToId ?? {};
  } catch (e) {
    progress.phase = 'error';
    progress.message = `Folder setup failed: ${e instanceof Error ? e.message : String(e)}`;
    errors.push(progress.message);
    onProgress({ ...progress });
    await reader.close();
    return { uploadedNames, skippedCount: 0, folderCount: 0, errors, cancelled: false };
  }

  // Files that need to land at the root of the data room are not supported by
  // the rest of this flow (folder_id is non-null in our schema). If any file
  // had no folder prefix after wrapper stripping, push it into an "Imported"
  // bucket so it isn't lost.
  let rootFolderId: string | null = null;
  if (files.some((f) => !f.folderPath)) {
    try {
      const res = await fetch('/api/dataroom/folders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, paths: ['Imported'] }),
      });
      const body = await res.json();
      if (res.ok) rootFolderId = body.pathToId?.['Imported'] ?? null;
    } catch {
      // Non-fatal; root files will just be skipped if we couldn't make the bucket.
    }
  }

  if (signal?.aborted) return cancel(progress, onProgress, reader, uploadedNames, errors);

  // ── 5. Build dedup set from existing docs in the target folders ─────────
  // Spec is "dedupe by (name, size)" but images that pass through
  // maybeCompressImage end up stored at a *smaller* size than the ZIP entry's
  // uncompressed size. To keep re-runs idempotent for images, we fall back to
  // a name-only match for compressible MIME types. Non-images use (name, size)
  // as specified.
  const folderIds = [...new Set(Object.values(pathToId))];
  if (rootFolderId) folderIds.push(rootFolderId);

  const dedupKey = (folderId: string, name: string, size: number) =>
    `${folderId}|${name.toLowerCase()}|${size}`;
  const nameOnlyKey = (folderId: string, name: string) =>
    `${folderId}|${name.toLowerCase()}`;
  const dedupSet = new Set<string>();
  const imageNameSet = new Set<string>();
  if (folderIds.length > 0) {
    const { data: existingDocs } = await supabase
      .from('terminal_dd_documents')
      .select('folder_id, name, display_name, file_size')
      .in('folder_id', folderIds);
    for (const d of (existingDocs ?? []) as Array<{
      folder_id: string;
      name: string;
      display_name: string | null;
      file_size: string | null;
    }>) {
      const dn = d.display_name ?? d.name;
      const sz = parseInt(d.file_size ?? '0', 10) || 0;
      dedupSet.add(dedupKey(d.folder_id, dn, sz));
      if (isCompressibleImageName(dn)) {
        imageNameSet.add(nameOnlyKey(d.folder_id, dn));
      }
    }
  }

  // ── 6. Upload files with a small concurrent pool ────────────────────────
  progress.phase = 'uploading';
  progress.message = `Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`;
  onProgress({ ...progress });

  // Pre-bake the supabase access token + endpoint for tus.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < files.length) {
      if (signal?.aborted) return;
      const i = cursor++;
      const rec = files[i];
      const folderId = rec.folderPath ? pathToId[rec.folderPath] : rootFolderId;
      if (!folderId) {
        errors.push(`${rec.fileName}: target folder unavailable`);
        continue;
      }
      const isImage = isCompressibleImageName(rec.fileName);
      const dupBySizeName = dedupSet.has(dedupKey(folderId, rec.fileName, rec.size));
      const dupByImageName = isImage && imageNameSet.has(nameOnlyKey(folderId, rec.fileName));
      if (dupBySizeName || dupByImageName) {
        filesSkipped++;
        progress.filesSkipped = filesSkipped;
        progress.filesCompleted++;
        progress.currentFile = rec.fileName;
        onProgress({ ...progress });
        continue;
      }
      progress.currentFile = rec.fileName;
      onProgress({ ...progress });

      try {
        const uploaded = await uploadOne({
          rec,
          folderId,
          dealId,
          userId,
          supabase,
          accessToken,
          supabaseUrl,
          supabaseAnonKey,
          onChunkProgress: (delta) => {
            progress.bytesUploaded += delta;
            onProgress({ ...progress });
          },
          onRetry: (attempt, err) => {
            progress.currentFile = `${rec.fileName} (retry ${attempt}/${MAX_UPLOAD_ATTEMPTS - 1} · ${shortErr(err)})`;
            onProgress({ ...progress });
          },
          signal,
        });
        if (uploaded) {
          uploadedNames.push(rec.fileName);
          // Once uploaded, mark the dedup keys so a same-run duplicate is caught.
          dedupSet.add(dedupKey(folderId, rec.fileName, rec.size));
          if (isImage) imageNameSet.add(nameOnlyKey(folderId, rec.fileName));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${rec.fileName}: ${msg}`);
      }
      progress.filesCompleted++;
      onProgress({ ...progress });
    }
  }

  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, () => worker()));

  if (signal?.aborted) return cancel(progress, onProgress, reader, uploadedNames, errors);

  await reader.close();

  progress.phase = 'done';
  progress.currentFile = null;
  progress.message = `Uploaded ${uploadedNames.length} of ${files.length} file${files.length === 1 ? '' : 's'}` +
    (filesSkipped > 0 ? ` · ${filesSkipped} skipped` : '') +
    (errors.length > 0 ? ` · ${errors.length} failed` : '');
  onProgress({ ...progress });

  return {
    uploadedNames,
    skippedCount: filesSkipped,
    folderCount: folderPathsSet.size,
    errors,
    cancelled: false,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function uploadOne(args: {
  rec: { entry: Entry; folderPath: string; fileName: string; size: number };
  folderId: string;
  dealId: string;
  userId: string | null;
  supabase: SupabaseClient;
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  onChunkProgress: (delta: number) => void;
  onRetry?: (attempt: number, err: unknown) => void;
  signal?: AbortSignal;
}): Promise<boolean> {
  const {
    rec, folderId, dealId, userId, supabase,
    accessToken, supabaseUrl, supabaseAnonKey, onChunkProgress, onRetry, signal,
  } = args;

  const contentType = guessContentType(rec.fileName);

  // Decompress to a Blob. zip.js writes large entries to memory-mapped blobs
  // automatically, so this doesn't load the whole ZIP — just this one entry.
  // The Entry type marks getData as optional (directory entries don't have it)
  // but we've already filtered those out, hence the cast.
  const entryWithData = rec.entry as Entry & {
    getData: (writer: BlobWriter) => Promise<Blob>;
  };
  const rawBlob = await entryWithData.getData(new BlobWriter(contentType));

  // Match the single-file upload path: re-encode large JPEG/PNG/WebP through
  // browser-image-compression so the Supabase image-render endpoint accepts
  // them and investor page loads aren't hauling 25MB originals. Wrap the Blob
  // in a File since maybeCompressImage keys off file.name.
  const fileForCompress = new File([rawBlob], rec.fileName, { type: contentType });
  const toUpload = await maybeCompressImage(fileForCompress);
  const uploadSize = toUpload.size;
  const uploadType = toUpload.type || contentType;

  // Storage upload with retry on transient errors (504/503/502/network). Each
  // attempt gets its own storage path so a partial leftover from a failed
  // attempt doesn't collide on retry. `bytesReportedThisAttempt` lets us roll
  // back the progress counter before retrying so the bar stays accurate.
  let bytesReportedThisAttempt = 0;
  const attemptOnChunk = (delta: number) => {
    bytesReportedThisAttempt += delta;
    onChunkProgress(delta);
  };

  let finalStoragePath = '';
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new Error('Cancelled');

    const safeName = sanitizeStorageName(rec.fileName);
    const storagePath = `${dealId}/${folderId}/${Date.now()}-${attempt}-${safeName}`;
    bytesReportedThisAttempt = 0;

    try {
      if (uploadSize > TUS_THRESHOLD_BYTES) {
        await tusUpload({
          blob: toUpload,
          storagePath,
          contentType: uploadType,
          supabaseUrl,
          accessToken,
          supabaseAnonKey,
          onChunkProgress: attemptOnChunk,
          signal,
        });
      } else {
        const { error } = await supabase.storage
          .from('terminal-dd-documents')
          .upload(storagePath, toUpload, { upsert: false, contentType: uploadType });
        if (error) throw error;
        attemptOnChunk(uploadSize);
      }
      finalStoragePath = storagePath;
      break;
    } catch (err) {
      lastErr = err;
      // Roll back the bytes we reported for this failed attempt so the next
      // attempt re-reports them cleanly.
      if (bytesReportedThisAttempt > 0) {
        onChunkProgress(-bytesReportedThisAttempt);
        bytesReportedThisAttempt = 0;
      }
      if (signal?.aborted) throw new Error('Cancelled');
      if (attempt >= MAX_UPLOAD_ATTEMPTS || !isRetryableError(err)) throw err;
      onRetry?.(attempt, err);
      // Exponential backoff: 1.5s, 3s, 6s…
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1), signal);
    }
  }

  if (!finalStoragePath) throw lastErr ?? new Error('Upload failed');
  const storagePath = finalStoragePath;

  // sort_order: just append. For master uploads we don't try to preserve any
  // ZIP-internal ordering — files land in arrival order.
  const { data: siblings } = await supabase
    .from('terminal_dd_documents')
    .select('sort_order')
    .eq('folder_id', folderId);
  const nextOrder = (siblings ?? []).reduce(
    (max: number, s: { sort_order: number }) => (s.sort_order > max ? s.sort_order : max),
    -1,
  ) + 1;

  const { error: insertErr } = await supabase
    .from('terminal_dd_documents')
    .insert({
      deal_id: dealId,
      folder_id: folderId,
      name: rec.fileName,
      display_name: rec.fileName,
      file_size: String(uploadSize),
      file_type: uploadType,
      storage_path: storagePath,
      uploaded_by: userId,
      sort_order: nextOrder,
    });

  if (insertErr) {
    await supabase.storage.from('terminal-dd-documents').remove([storagePath]);
    throw new Error(`DB insert failed: ${insertErr.message}`);
  }

  return true;
}

// Resumable upload through Supabase's TUS endpoint. Auth headers carry the
// user's session so RLS applies the same as a normal supabase-js upload.
function tusUpload(args: {
  blob: Blob;
  storagePath: string;
  contentType: string;
  supabaseUrl: string;
  accessToken: string;
  supabaseAnonKey: string;
  onChunkProgress: (delta: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    let lastBytes = 0;
    const upload = new tus.Upload(args.blob, {
      endpoint: `${args.supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${args.accessToken}`,
        apikey: args.supabaseAnonKey,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'terminal-dd-documents',
        objectName: args.storagePath,
        contentType: args.contentType,
        cacheControl: '3600',
      },
      // Match Supabase's recommended chunk size; smaller chunks waste roundtrips,
      // larger ones blow past Vercel's edge gateway buffer.
      chunkSize: 6 * 1024 * 1024,
      onError: (err) => reject(err),
      onProgress: (bytesUploaded) => {
        const delta = bytesUploaded - lastBytes;
        lastBytes = bytesUploaded;
        if (delta > 0) args.onChunkProgress(delta);
      },
      onSuccess: () => resolve(),
    });

    args.signal?.addEventListener('abort', () => {
      upload.abort(true).catch(() => {});
      reject(new Error('Cancelled'));
    });

    upload.start();
  });
}

function cancel(
  progress: BulkUploadProgress,
  onProgress: (p: BulkUploadProgress) => void,
  reader: ZipReader<unknown>,
  uploadedNames: string[],
  errors: string[],
): BulkUploadResult {
  progress.phase = 'cancelled';
  progress.message = 'Cancelled.';
  onProgress({ ...progress });
  reader.close().catch(() => {});
  return { uploadedNames, skippedCount: 0, folderCount: 0, errors, cancelled: true };
}

// Retry-eligible errors: anything that looks like a 5xx gateway / network blip
// from the Supabase upload path. We deliberately exclude 4xx (validation,
// auth) and AbortError so cancellation doesn't get retried into oblivion.
function isRetryableError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { name?: string; message?: string; statusCode?: number; status?: number };
  if (err.name === 'AbortError') return false;
  const code = err.statusCode ?? err.status;
  if (typeof code === 'number') {
    if (code >= 500 && code <= 599) return true;
    if (code === 408 || code === 425 || code === 429) return true;
    return false;
  }
  const msg = (err.message ?? '').toLowerCase();
  if (msg.includes('cancelled') || msg.includes('aborted')) return false;
  return (
    msg.includes('504') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('gateway') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('econnreset')
  );
}

// Short error label for the "(retry n/m · <err>)" status line — keep it under
// ~30 chars so the file row doesn't wrap awkwardly.
function shortErr(e: unknown): string {
  if (!e || typeof e !== 'object') return 'error';
  const err = e as { statusCode?: number; status?: number; message?: string };
  const code = err.statusCode ?? err.status;
  if (typeof code === 'number') return `HTTP ${code}`;
  const msg = (err.message ?? 'error').replace(/\s+/g, ' ').trim();
  return msg.length > 30 ? msg.slice(0, 27) + '…' : msg;
}

// Cancellable delay — resolves on the timeout OR when the signal aborts.
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export { formatBytes };

// Mirrors COMPRESSIBLE_MIMES in imageCompression.ts — files matching this list
// may end up smaller in storage than their ZIP-entry uncompressedSize, which
// would otherwise defeat the (name, size) dedup on re-runs.
function isCompressibleImageName(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp';
}

// Browsers don't always set a sensible content-type for arbitrary file
// extensions in a Blob. Set the common ones we expect so previews and PDF
// watermarking work without a follow-up MIME sniff.
function guessContentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'tif':
    case 'tiff': return 'image/tiff';
    case 'heic': return 'image/heic';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls': return 'application/vnd.ms-excel';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'ppt': return 'application/vnd.ms-powerpoint';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'csv': return 'text/csv';
    case 'txt': return 'text/plain';
    case 'zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}
