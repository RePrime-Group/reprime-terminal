'use client';

import Button from '@/components/ui/Button';

// Sticky bar that appears when the admin has selected one or more files.
// Sits above the tree; clear/cancel dismisses selection.
export function BulkBar({
  count,
  onMove,
  onDelete,
  onDownload,
  onClear,
}: {
  count: number;
  onMove: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="sticky top-0 z-10 mb-3 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-rp-navy text-white shadow-md">
      <span className="text-sm font-semibold">
        {count} selected
      </span>
      <div className="flex-1" />
      <Button variant="secondary" size="sm" onClick={onDownload}>
        Download
      </Button>
      <Button variant="secondary" size="sm" onClick={onMove}>
        Move to…
      </Button>
      <Button variant="danger" size="sm" onClick={onDelete}>
        Delete
      </Button>
      <button
        onClick={onClear}
        className="ml-1 text-white/70 hover:text-white text-xs"
        aria-label="Clear selection"
      >
        Clear
      </button>
    </div>
  );
}
