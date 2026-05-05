import { sanitizePathSegment, dedupePath } from './dataRoomPaths';

// File System Access API isn't in lib.dom.d.ts yet (as of this TS version).
// Minimal declaration covers what we use; we feature-detect at runtime.
declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  }
}

export interface PackageDoc {
  id: string;
  fileName: string;
  folderPath: string;
}

export interface PackageProgress {
  done: number;
  total: number;
  currentFile: string | null;
  phase: 'awaiting_save' | 'packaging' | 'fetching' | 'retrying' | 'zipping' | 'finalizing';
  zipPercent?: number;
  retryRound?: number;
  retryDone?: number;
  retryTotal?: number;
  // Multi-zip fallback only — which top-level folder ZIP we're on.
  groupName?: string;
  groupIdx?: number;
  totalGroups?: number;
}

export interface PackageFailure {
  name: string;
  reason: string;
}

export interface PackageResult {
  failures: PackageFailure[];
  succeeded: number;
  total: number;
  /** True if user cancelled the native save dialog. UI treats this as "user
   * changed their mind", not an error. */
  cancelledAtSavePrompt?: boolean;
}

export interface BuildAndDownloadOpts {
  dealId: string;
  dealName: string;
  mode: 'complete_package' | 'selected_package';
  docs: PackageDoc[];
  concurrency?: number;
  signal: AbortSignal;
  onProgress?: (p: PackageProgress) => void;
}

const RETRY_ATTEMPTS_PER_DOC = 3; // initial + 2 retries
const RETRY_DELAYS_MS = [500, 1500];
// Small gap between consecutive download triggers in the multi-zip fallback —
// some browsers throttle / prompt for "allow multiple downloads" without one.
const MULTI_ZIP_DOWNLOAD_GAP_MS = 400;

function safeDealName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Deal';
}

function safeGroupName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Section';
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function logBundle(opts: BuildAndDownloadOpts): Promise<void> {
  try {
    await fetch(`/api/deals/${opts.dealId}/package/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        type: opts.mode,
        count: opts.docs.length,
        doc_ids: opts.docs.map((d) => d.id),
      }),
    });
  } catch {
    // Activity logging is best-effort; never block the download.
  }
}

function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

function buildPath(doc: PackageDoc, usedPaths: Set<string>): string {
  const safeName = sanitizePathSegment(doc.fileName);
  const safeDir = doc.folderPath
    .split('/')
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join('/');
  const rawPath = safeDir ? `${safeDir}/${safeName}` : safeName;
  return dedupePath(rawPath, usedPaths);
}

// Single fetch with bounded retries. Throws AbortError on cancel; throws the
// last seen error after the retry budget is exhausted.
async function fetchDocResponse(doc: PackageDoc, signal: AbortSignal): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS_PER_DOC; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 1500, signal);
    }
    try {
      const res = await fetch(`/api/documents/${doc.id}/download?bulk=1`, {
        signal,
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}

// Group docs by their top-level folder name so we can split a giant package
// into per-section ZIPs in the Firefox fallback. Docs with no folder land in
// "General" so they always go somewhere.
function groupByTopLevel(docs: PackageDoc[]): Map<string, PackageDoc[]> {
  const groups = new Map<string, PackageDoc[]>();
  for (const doc of docs) {
    const parts = doc.folderPath.split('/').filter(Boolean);
    const top = parts[0] || 'General';
    const list = groups.get(top);
    if (list) list.push(doc);
    else groups.set(top, [doc]);
  }
  return groups;
}

// ─── Strategy A: client-zip + File System Access API ────────────────────────
// True end-to-end streaming. Bytes flow: Supabase → fetch Response stream →
// client-zip's ReadableStream → FileSystemWritableFileStream → disk. Memory
// peak is one chunk anywhere in that pipeline.
async function runFsaClientZip(opts: BuildAndDownloadOpts): Promise<PackageResult> {
  const { signal, onProgress } = opts;
  const total = opts.docs.length;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 8));

  // Open the save dialog *before* doing any work — if the user cancels the
  // picker we want to bail without having fired off fetches or written log
  // rows.
  onProgress?.({ done: 0, total, currentFile: null, phase: 'awaiting_save' });

  const suffix = opts.mode === 'selected_package' ? 'Selected Documents' : 'Due Diligence Package';
  const filename = `${safeDealName(opts.dealName)} - ${suffix}.zip`;

  let handle: FileSystemFileHandle;
  try {
    handle = await window.showSaveFilePicker!({
      suggestedName: filename,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    });
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') {
      // Picker dismissed — surface as a "user changed their mind" result, not
      // an error.
      return { failures: [], succeeded: 0, total, cancelledAtSavePrompt: true };
    }
    throw err;
  }

  // We've committed at this point — log the bundle attempt.
  void logBundle(opts);

  const writable = await handle.createWritable();

  const failures: PackageFailure[] = [];
  let done = 0;
  const usedPaths = new Set<string>();

  // Concurrent prefetch with sequential yield to client-zip. Yields in
  // completion order (ZIP entry order doesn't matter); pipeline depth keeps
  // ~`concurrency` responses in flight at all times.
  async function* fileIterator() {
    const queue: Promise<{ name: string; input: Response } | null>[] = [];
    let cursor = 0;

    const enqueueNext = () => {
      while (queue.length < concurrency && cursor < total) {
        const idx = cursor++;
        const doc = opts.docs[idx];
        const promise = fetchDocResponse(doc, signal)
          .then((response) => ({
            name: buildPath(doc, usedPaths),
            input: response,
          }))
          .catch((err) => {
            if ((err as DOMException)?.name === 'AbortError') throw err;
            failures.push({
              name: doc.fileName,
              reason: err instanceof Error ? err.message : 'unknown',
            });
            return null;
          })
          .finally(() => {
            done += 1;
            onProgress?.({ done, total, currentFile: doc.fileName, phase: 'packaging' });
          });
        queue.push(promise);
      }
    };

    enqueueNext();
    while (queue.length > 0) {
      const result = await queue.shift()!;
      enqueueNext();
      if (result) yield result;
    }
  }

  // Dynamic import keeps client-zip out of the initial bundle.
  const { downloadZip } = await import('client-zip');
  const zipResponse = downloadZip(fileIterator());

  try {
    // pipeTo with the abort signal teardown both ends if the user cancels.
    await zipResponse.body!.pipeTo(writable, { signal });
  } catch (err) {
    // Make sure the partial file is closed/aborted on every error path so the
    // browser doesn't leave a half-written file open.
    await writable.abort('error').catch(() => {});
    throw err;
  }

  if (failures.length > 0) {
    console.warn(`[clientZipPackage] ${failures.length} file(s) failed:`, failures);
  }

  onProgress?.({ done, total, currentFile: null, phase: 'finalizing' });

  return { failures, succeeded: total - failures.length, total };
}

// ─── Strategy B: Multi-ZIP fallback (Firefox) ───────────────────────────────
// One JSZip per top-level folder. Each piece is small enough to fit in memory
// using the Blob approach. Triggers N consecutive downloads through anchor
// clicks; the browser may prompt once for "allow multiple downloads".
async function runMultiZipFallback(opts: BuildAndDownloadOpts): Promise<PackageResult> {
  const { signal, onProgress } = opts;
  const total = opts.docs.length;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 8));

  void logBundle(opts);

  const groups = Array.from(groupByTopLevel(opts.docs).entries()).sort(([a], [b]) => a.localeCompare(b));
  const totalGroups = groups.length;
  const dealStem = safeDealName(opts.dealName);
  const suffix = opts.mode === 'selected_package' ? 'Selected Documents' : 'Due Diligence Package';

  const failures: PackageFailure[] = [];
  let doneAcrossGroups = 0;

  const { default: JSZip } = await import('jszip');

  for (let g = 0; g < groups.length; g++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const [groupName, docs] = groups[g];
    const groupIdx = g + 1;
    const usedPaths = new Set<string>();
    const zip = new JSZip();

    // Concurrent fetch within this group. Failures get retried by
    // fetchDocResponse already; nothing further to retry here.
    let cursor = 0;

    onProgress?.({
      done: doneAcrossGroups,
      total,
      currentFile: null,
      phase: 'fetching',
      groupName,
      groupIdx,
      totalGroups,
    });

    const worker = async (): Promise<void> => {
      while (true) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const idx = cursor++;
        if (idx >= docs.length) return;
        const doc = docs[idx];
        try {
          const res = await fetchDocResponse(doc, signal);
          const blob = await res.blob();
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          zip.file(buildPath(doc, usedPaths), blob);
        } catch (err) {
          if ((err as DOMException)?.name === 'AbortError') throw err;
          failures.push({
            name: doc.fileName,
            reason: err instanceof Error ? err.message : 'unknown',
          });
        } finally {
          doneAcrossGroups += 1;
          onProgress?.({
            done: doneAcrossGroups,
            total,
            currentFile: doc.fileName,
            phase: 'fetching',
            groupName,
            groupIdx,
            totalGroups,
          });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, docs.length) }, () => worker()));

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    onProgress?.({
      done: doneAcrossGroups,
      total,
      currentFile: null,
      phase: 'zipping',
      zipPercent: 0,
      groupName,
      groupIdx,
      totalGroups,
    });

    const blob = await zip.generateAsync(
      { type: 'blob', streamFiles: true, compression: 'STORE' },
      (meta) => {
        onProgress?.({
          done: doneAcrossGroups,
          total,
          currentFile: meta.currentFile ?? null,
          phase: 'zipping',
          zipPercent: meta.percent,
          groupName,
          groupIdx,
          totalGroups,
        });
      },
    );

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // Trigger this part's download via a hidden anchor.
    const partName = totalGroups > 1
      ? `${dealStem} - ${suffix} - ${safeGroupName(groupName)}.zip`
      : `${dealStem} - ${suffix}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = partName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    // Brief gap so the browser sees them as distinct downloads instead of a
    // single rapid burst (which some block).
    if (g < groups.length - 1) {
      await sleep(MULTI_ZIP_DOWNLOAD_GAP_MS, signal);
    }
  }

  if (failures.length > 0) {
    console.warn(`[clientZipPackage] ${failures.length} file(s) failed:`, failures);
  }

  onProgress?.({ done: doneAcrossGroups, total, currentFile: null, phase: 'finalizing' });

  return { failures, succeeded: total - failures.length, total };
}

// ─── Public entry point ─────────────────────────────────────────────────────
export async function buildAndDownloadZip(opts: BuildAndDownloadOpts): Promise<PackageResult> {
  if (opts.docs.length === 0) {
    return { failures: [], succeeded: 0, total: 0 };
  }
  if (supportsFileSystemAccess()) {
    return runFsaClientZip(opts);
  }
  return runMultiZipFallback(opts);
}
