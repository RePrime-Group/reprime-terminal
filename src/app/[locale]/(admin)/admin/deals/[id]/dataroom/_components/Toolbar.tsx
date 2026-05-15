'use client';

import { useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { BulkZipUploadModal } from './BulkZipUploadModal';

// Top toolbar: + New Folder, Populate DD, master ZIP upload, notify toggle.
// The "Upload Files" action is handled per-folder (right-click menu or desktop
// drag onto a folder in the tree) so the toolbar doesn't need a separate
// "upload into what" flow.
export function Toolbar({
  dealId,
  dealName,
  userId,
  uploading,
  notifyOnUpload,
  onToggleNotify,
  onNewFolder,
  onRefresh,
}: {
  dealId: string;
  dealName: string;
  userId: string | null;
  uploading: boolean;
  notifyOnUpload: boolean;
  onToggleNotify: () => void;
  onNewFolder: () => void;
  onRefresh: () => Promise<void> | void;
}) {
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkToast, setBulkToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [populating, setPopulating] = useState(false);

  function handleBulkUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext !== 'zip') {
      setBulkToast({ type: 'error', message: 'Only ZIP files are accepted for bulk upload.' });
      if (bulkInputRef.current) bulkInputRef.current.value = '';
      return;
    }
    setBulkToast(null);
    setBulkFile(file);
    setBulkOpen(true);
    if (bulkInputRef.current) bulkInputRef.current.value = '';
  }

  async function handlePopulate() {
    setPopulating(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/populate-dd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.skipped) {
          alert('This deal already has folders — nothing to add.');
        } else {
          alert(`Created ${data.foldersCreated} standard DD folder${data.foldersCreated === 1 ? '' : 's'}.`);
        }
        await onRefresh();
      } else {
        alert(data.error || 'Failed to populate');
      }
    } finally {
      setPopulating(false);
    }
  }

  void dealName; // reserved for future banner display

  return (
    <div>
      {/* Title + header actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-semibold text-rp-navy">Documents &amp; Folders</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onNewFolder} disabled={uploading}>
            + New Folder
          </Button>
          <Button variant="gold" size="sm" onClick={handlePopulate} loading={populating}>
            ⚡ Create DD Folders
          </Button>
        </div>
      </div>

      {/* Master ZIP upload — client-side extraction, folder-aware. */}
      <div className="mb-4 rounded-xl border border-rp-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-rp-navy">Bulk Upload (Organized ZIP)</h3>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={bulkInputRef}
              type="file"
              className="hidden"
              accept=".zip"
              onChange={(e) => handleBulkUpload(e.target.files)}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => bulkInputRef.current?.click()}
              disabled={bulkOpen}
            >
              Upload Master ZIP
            </Button>
          </div>
        </div>

        {bulkToast && (
          <div
            className={`mt-3 rounded-lg px-4 py-2.5 text-sm ${
              bulkToast.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}
          >
            {bulkToast.message}
          </div>
        )}
      </div>

      <BulkZipUploadModal
        isOpen={bulkOpen}
        dealId={dealId}
        userId={userId}
        notifyOnUpload={notifyOnUpload}
        file={bulkFile}
        onClose={() => {
          setBulkOpen(false);
          setBulkFile(null);
        }}
        onAfterDone={onRefresh}
      />

      {/* Notify toggle */}
      <div className="flex items-start justify-between gap-4 mb-4 px-4 py-3 rounded-lg bg-white border border-rp-gray-200">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-rp-navy">Notify investors after upload</div>
          <div className="text-[11px] text-rp-gray-500 mt-0.5">
            Sends an in-app and email notification to investors who have signed this deal&apos;s NDA
            or the blanket NDA. Applies to each file you upload while this is on.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={notifyOnUpload}
          onClick={onToggleNotify}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 mt-0.5 ${
            notifyOnUpload ? 'bg-rp-gold' : 'bg-rp-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              notifyOnUpload ? 'translate-x-[22px]' : 'translate-x-[2px]'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
