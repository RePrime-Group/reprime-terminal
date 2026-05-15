'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import {
  bulkZipUpload,
  formatBytes,
  type BulkUploadProgress,
} from '../_lib/bulkZipUpload';

interface Props {
  isOpen: boolean;
  dealId: string;
  userId: string | null;
  notifyOnUpload: boolean;
  file: File | null;
  onClose: () => void;
  onAfterDone: () => Promise<void> | void;
}

// Single-shot dialog: receives the picked .zip from the toolbar, runs the
// full upload pipeline, displays progress, and offers a notify-investors
// summary at the end if the toggle was on.
export function BulkZipUploadModal({
  isOpen,
  dealId,
  userId,
  notifyOnUpload,
  file,
  onClose,
  onAfterDone,
}: Props) {
  const [progress, setProgress] = useState<BulkUploadProgress | null>(null);
  const [done, setDone] = useState(false);
  const [notifyState, setNotifyState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const startedForFileRef = useRef<File | null>(null);

  // Kick off as soon as we open with a file. We use a ref guard so React 19's
  // re-mount doesn't accidentally start the upload twice for the same file.
  useEffect(() => {
    if (!isOpen || !file) return;
    if (startedForFileRef.current === file) return;
    startedForFileRef.current = file;

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(null);
    setDone(false);
    setNotifyState('idle');

    (async () => {
      const supabase = createClient();
      const result = await bulkZipUpload({
        dealId,
        userId,
        zipFile: file,
        supabase,
        signal: controller.signal,
        onProgress: (p) => setProgress({ ...p }),
      });
      setDone(true);

      if (
        notifyOnUpload &&
        !result.cancelled &&
        result.uploadedNames.length > 0
      ) {
        setNotifyState('sending');
        try {
          const res = await fetch(`/api/admin/deals/${dealId}/notify-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'document_upload', docNames: result.uploadedNames }),
          });
          setNotifyState(res.ok ? 'sent' : 'failed');
        } catch {
          setNotifyState('failed');
        }
      }

      // Refresh the tree so newly-added folders/files show up.
      await onAfterDone();
    })();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, file]);

  // Warn before tab close while in flight.
  useEffect(() => {
    if (!isOpen || done) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isOpen, done]);

  if (!isOpen) return null;

  // Percentage tracks files completed, not bytes uploaded — image compression
  // can shrink uploaded bytes 5–10× vs. the ZIP entry's uncompressedSize, which
  // would otherwise leave the bar stuck low even after every file finished.
  // Bytes uploaded is still shown as a separate stat.
  let pct = 0;
  if (progress) {
    if (progress.phase === 'done') {
      pct = 100;
    } else if (progress.filesTotal > 0) {
      pct = Math.min(100, Math.round((progress.filesCompleted / progress.filesTotal) * 100));
    }
  }

  const canClose = done || progress?.phase === 'error' || progress?.phase === 'cancelled';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-rp-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-rp-navy">Master ZIP Upload</h2>
            <p className="text-xs text-rp-gray-500 mt-0.5 truncate max-w-[480px]">
              {file?.name ?? ''} {file ? `· ${formatBytes(file.size)}` : ''}
            </p>
          </div>
          <button
            onClick={canClose ? onClose : undefined}
            disabled={!canClose}
            className="text-rp-gray-400 hover:text-rp-navy disabled:opacity-30 disabled:cursor-not-allowed text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {!progress && (
            <p className="text-sm text-rp-gray-500">Preparing…</p>
          )}

          {progress && (
            <>
              <div className="mb-2 flex items-center justify-between text-[12px]">
                <span className="font-medium text-rp-navy">{progress.message}</span>
                <span className="text-rp-gold font-semibold tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-rp-gray-200 overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progress.phase === 'error' || progress.phase === 'cancelled'
                      ? 'bg-red-400'
                      : 'bg-gradient-to-r from-rp-gold to-rp-gold-soft'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <Stat label="Files" value={`${progress.filesCompleted} / ${progress.filesTotal}`} />
                <Stat label="Skipped (dupes)" value={String(progress.filesSkipped)} />
                <Stat label="Uploaded" value={formatBytes(progress.bytesUploaded)} />
              </div>

              {progress.currentFile && progress.phase === 'uploading' && (
                <p className="text-[11px] text-rp-gray-500 truncate">
                  Now: <span className="text-rp-navy">{progress.currentFile}</span>
                </p>
              )}

              {progress.errors.length > 0 && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 max-h-[140px] overflow-y-auto">
                  <p className="text-[11px] font-semibold text-red-700 mb-1">
                    {progress.errors.length} error{progress.errors.length === 1 ? '' : 's'}
                  </p>
                  <ul className="text-[11px] text-red-700 space-y-0.5">
                    {progress.errors.slice(0, 50).map((err, i) => (
                      <li key={i} className="truncate">• {err}</li>
                    ))}
                    {progress.errors.length > 50 && (
                      <li className="italic">… and {progress.errors.length - 50} more</li>
                    )}
                  </ul>
                </div>
              )}

              {done && notifyState !== 'idle' && (
                <div className="mt-4 text-[12px]">
                  {notifyState === 'sending' && <span className="text-rp-gray-500">Notifying investors…</span>}
                  {notifyState === 'sent' && <span className="text-emerald-700">Investors notified.</span>}
                  {notifyState === 'failed' && <span className="text-red-600">Notification failed.</span>}
                </div>
              )}

              {!done && progress.phase !== 'error' && progress.phase !== 'cancelled' && (
                <div className="mt-5 text-[11px] text-rp-gray-500 italic">
                  Keep this tab open. Closing it will stop the upload — folders and files already added are kept.
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-rp-gray-200 flex justify-end gap-2">
          {!done && progress?.phase !== 'error' && progress?.phase !== 'cancelled' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => abortRef.current?.abort()}
            >
              Cancel
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-rp-gray-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-rp-gray-400">{label}</div>
      <div className="text-[13px] font-semibold text-rp-navy mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
