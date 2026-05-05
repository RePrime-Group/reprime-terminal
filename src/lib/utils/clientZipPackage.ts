import type JSZipType from 'jszip';
import { sanitizePathSegment, dedupePath } from './dataRoomPaths';

export interface PackageDoc {
  id: string;
  fileName: string;
  folderPath: string;
}

export interface PackageProgress {
  done: number;
  total: number;
  currentFile: string | null;
  phase: 'fetching' | 'retrying' | 'zipping' | 'finalizing';
  zipPercent?: number;
  retryRound?: number;
  retryDone?: number;
  retryTotal?: number;
}

export interface PackageFailure {
  name: string;
  reason: string;
}

export interface PackageResult {
  failures: PackageFailure[];
  succeeded: number;
  total: number;
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

// Two retry rounds with backoff. Most Supabase Storage 5xx blips are transient
// (signed-URL race, a node restart, brief 503). One retry catches the
// overwhelming majority; a second mops up the long-tail without dragging the
// download out forever.
const RETRY_DELAYS_MS = [500, 1500];

function safeDealName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Deal';
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

async function fetchAsBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const res = await fetch(url, { signal, credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.blob();
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

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Adds a single doc to the zip, throws on any non-AbortError failure.
async function fetchDocIntoZip(
  doc: PackageDoc,
  zip: JSZipType,
  usedPaths: Set<string>,
  signal: AbortSignal,
): Promise<void> {
  const url = `/api/documents/${doc.id}/download?bulk=1`;
  const blob = await fetchAsBlob(url, signal);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const safeName = sanitizePathSegment(doc.fileName);
  const safeDir = doc.folderPath
    .split('/')
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join('/');
  const rawPath = safeDir ? `${safeDir}/${safeName}` : safeName;
  const path = dedupePath(rawPath, usedPaths);
  // Hand JSZip the Blob directly — it reads bytes lazily during
  // generateAsync(), so peak memory is ~one file at a time instead of
  // (concurrency × largest file) doubled by an arrayBuffer copy.
  zip.file(path, blob);
}

export async function buildAndDownloadZip(opts: BuildAndDownloadOpts): Promise<PackageResult> {
  const { signal, onProgress } = opts;
  // 3 workers is the sweet spot: enough parallelism to mask per-request
  // latency (auth + watermarking on the server), but low enough that a deal
  // full of 50 MB scans doesn't OOM the tab during the fetch phase.
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 8));
  const total = opts.docs.length;

  if (total === 0) return { failures: [], succeeded: 0, total: 0 };

  // Dynamic import keeps JSZip out of the initial bundle — only loads when an
  // investor actually clicks Download All.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedPaths = new Set<string>();

  // Log the bundle once at the start; per-file requests carry ?bulk=1 to skip
  // their own log inserts.
  void logBundle(opts);

  let done = 0;
  let pending: PackageDoc[] = opts.docs.slice();
  let lastFailures: PackageFailure[] = [];

  onProgress?.({ done: 0, total, currentFile: null, phase: 'fetching' });

  // First pass: standard worker pool over every doc.
  {
    const failuresThisRound: PackageDoc[] = [];
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const idx = cursor++;
        if (idx >= pending.length) return;
        const doc = pending[idx];
        try {
          await fetchDocIntoZip(doc, zip, usedPaths, signal);
        } catch (err) {
          if ((err as DOMException)?.name === 'AbortError') throw err;
          failuresThisRound.push(doc);
          lastFailures.push({
            name: doc.fileName,
            reason: err instanceof Error ? err.message : 'unknown',
          });
        } finally {
          done += 1;
          onProgress?.({ done, total, currentFile: doc.fileName, phase: 'fetching' });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
    pending = failuresThisRound;
  }

  // Retry rounds: shrinking pool, with backoff sleep before each round, lower
  // concurrency to be gentle on a possibly-struggling backend.
  for (let round = 0; round < RETRY_DELAYS_MS.length && pending.length > 0; round++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    await sleep(RETRY_DELAYS_MS[round], signal);

    // Reset failure tracking for this round so only files that fail *this*
    // attempt remain in lastFailures.
    lastFailures = [];
    const retryConcurrency = Math.max(1, Math.min(2, pending.length));
    const failuresThisRound: PackageDoc[] = [];
    const retryTotal = pending.length;
    let retryDone = 0;
    let cursor = 0;

    onProgress?.({
      done,
      total,
      currentFile: null,
      phase: 'retrying',
      retryRound: round + 1,
      retryDone: 0,
      retryTotal,
    });

    const worker = async (): Promise<void> => {
      while (true) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const idx = cursor++;
        if (idx >= pending.length) return;
        const doc = pending[idx];
        try {
          await fetchDocIntoZip(doc, zip, usedPaths, signal);
        } catch (err) {
          if ((err as DOMException)?.name === 'AbortError') throw err;
          failuresThisRound.push(doc);
          lastFailures.push({
            name: doc.fileName,
            reason: err instanceof Error ? err.message : 'unknown',
          });
        } finally {
          retryDone += 1;
          onProgress?.({
            done,
            total,
            currentFile: doc.fileName,
            phase: 'retrying',
            retryRound: round + 1,
            retryDone,
            retryTotal,
          });
        }
      }
    };
    await Promise.all(Array.from({ length: retryConcurrency }, () => worker()));
    pending = failuresThisRound;
  }

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  if (lastFailures.length > 0) {
    console.warn(`[clientZipPackage] ${lastFailures.length} file(s) failed after retries:`, lastFailures);
  }

  onProgress?.({ done, total, currentFile: null, phase: 'zipping', zipPercent: 0 });

  // STORE (no compression) is the right call for a DD package: the contents
  // are mostly PDFs / JPEGs / scans that are already compressed, so DEFLATE
  // burns CPU and memory for ~0% size reduction. STORE also lets JSZip
  // stream entries through to the output blob without building a compressed
  // copy in memory first.
  const zipBlob = await zip.generateAsync(
    { type: 'blob', streamFiles: true, compression: 'STORE' },
    (meta) => {
      onProgress?.({
        done,
        total,
        currentFile: meta.currentFile ?? null,
        phase: 'zipping',
        zipPercent: meta.percent,
      });
    },
  );

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  onProgress?.({ done, total, currentFile: null, phase: 'finalizing', zipPercent: 100 });

  const suffix = opts.mode === 'selected_package' ? 'Selected Documents' : 'Due Diligence Package';
  triggerBlobDownload(zipBlob, `${safeDealName(opts.dealName)} - ${suffix}.zip`);

  return {
    failures: lastFailures,
    succeeded: total - lastFailures.length,
    total,
  };
}
