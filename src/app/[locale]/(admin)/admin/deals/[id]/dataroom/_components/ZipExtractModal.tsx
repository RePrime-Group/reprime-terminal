'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

export interface ZipExtractResult {
  foldersCreated: number;
  filesExtracted: number;
  errors: string[];
  classifications?: { fileName: string; category: string; confidence: string }[];
}

// Uploaded ZIPs trigger this modal. User picks AI classification (sorts by
// Claude into the 12 DD categories) or keep-original-structure (extract paths
// as-is, now fully recursive). On success we refresh the tree.
export function ZipExtractModal({
  isOpen,
  dealId,
  storagePath,
  targetFolderId,
  onClose,
  onAfterRefresh,
}: {
  isOpen: boolean;
  dealId: string;
  storagePath: string | null;
  targetFolderId: string | null;
  onClose: () => void;
  onAfterRefresh: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ZipExtractResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function keepStructure() {
    if (!storagePath) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const res = await fetch('/api/documents/extract-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, storagePath, targetFolderId }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        await onAfterRefresh();
      } else {
        setErr(data.error || 'ZIP extraction failed');
      }
    } catch {
      setErr('Network error during ZIP extraction');
    } finally {
      setBusy(false);
    }
  }

  async function aiClassify() {
    if (!storagePath) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const res = await fetch('/api/documents/ai-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, storagePath }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          foldersCreated: data.foldersCreated,
          filesExtracted: data.filesUploaded,
          errors: data.errors ?? [],
          classifications: data.classifications,
        });
        await onAfterRefresh();
      } else {
        setErr(data.error || 'AI classification failed');
      }
    } catch {
      setErr('Network error during AI classification');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setResult(null);
    setErr(null);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Extract ZIP Contents">
      {result ? (
        <div>
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-700">
              {result.classifications ? 'AI Classification Complete' : 'Extraction Complete'}
            </p>
            <p className="text-xs text-green-600/80 mt-1">
              {result.foldersCreated} folder{result.foldersCreated !== 1 ? 's' : ''} created,{' '}
              {result.filesExtracted} file{result.filesExtracted !== 1 ? 's' : ''} organized
            </p>
          </div>
          {result.classifications && result.classifications.length > 0 && (
            <div className="mb-3 max-h-[200px] overflow-y-auto">
              <p className="text-xs font-medium text-rp-navy mb-2">AI Classification Results:</p>
              {result.classifications.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 text-xs rounded hover:bg-rp-gray-100">
                  <span className="text-rp-gray-600 truncate flex-1">{c.fileName}</span>
                  <span className="text-rp-navy font-medium ml-2 shrink-0">{c.category}</span>
                  <span
                    className={`ml-2 text-[9px] font-bold uppercase shrink-0 ${
                      c.confidence === 'high'
                        ? 'text-green-600'
                        : c.confidence === 'medium'
                        ? 'text-amber-500'
                        : 'text-rp-gray-400'
                    }`}
                  >
                    {c.confidence}
                  </span>
                </div>
              ))}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 font-medium">Some files had issues:</p>
              <ul className="text-xs text-amber-600/80 mt-1 list-disc list-inside">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-rp-gray-600 mb-5">How should these files be organized?</p>
          <div className="flex flex-col gap-3 mb-5">
            <button
              onClick={aiClassify}
              disabled={busy}
              className="w-full p-4 rounded-xl border-2 border-rp-gold bg-rp-gold/5 text-left hover:shadow-md transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-[20px]">⚡</span>
                <div>
                  <div className="text-sm font-bold text-rp-navy">AI Smart Sort (Recommended)</div>
                  <div className="text-xs text-rp-gray-500 mt-0.5">
                    Claude reads filenames and sorts into DD categories: Financials, Legal, Leases, etc.
                  </div>
                </div>
              </div>
            </button>
            <button
              onClick={keepStructure}
              disabled={busy}
              className="w-full p-4 rounded-xl border border-rp-gray-200 text-left hover:border-rp-gray-300 transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-[20px]">📁</span>
                <div>
                  <div className="text-sm font-semibold text-rp-navy">Keep Original Folders</div>
                  <div className="text-xs text-rp-gray-500 mt-0.5">
                    Extract ZIP and preserve its folder structure (including nested subfolders).
                  </div>
                </div>
              </div>
            </button>
          </div>
          {busy && (
            <div className="flex items-center gap-2 p-3 bg-rp-gold/5 rounded-lg border border-rp-gold/30">
              <div className="w-4 h-4 border-2 border-rp-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium text-rp-navy">Processing…</span>
            </div>
          )}
          {err && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {err}
            </div>
          )}
          <div className="flex justify-end mt-3">
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
