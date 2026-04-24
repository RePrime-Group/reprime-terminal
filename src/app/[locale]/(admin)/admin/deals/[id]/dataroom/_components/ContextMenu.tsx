'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuState {
  x: number;
  y: number;
  target: { type: 'folder'; folderId: string } | { type: 'document'; docId: string };
}

export function ContextMenu({
  state,
  onClose,
  onUploadFiles,
  onNewSubfolder,
  onRename,
  onMoveTo,
  onDelete,
}: {
  state: ContextMenuState | null;
  onClose: () => void;
  onUploadFiles: (folderId: string) => void;
  onNewSubfolder: (folderId: string) => void;
  onRename: () => void;
  onMoveTo: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    // Defer attaching by one frame so the very click that opened the menu
    // doesn't immediately close it.
    const id = setTimeout(() => {
      document.addEventListener('click', handle);
      document.addEventListener('keydown', handleEsc);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', handle);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [state, onClose]);

  if (!state || typeof document === 'undefined') return null;

  const isFolder = state.target.type === 'folder';

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: Math.min(state.y, window.innerHeight - 200),
        left: Math.min(state.x, window.innerWidth - 180),
        zIndex: 1000,
      }}
      className="min-w-[160px] bg-white border border-rp-gray-200 rounded-lg shadow-lg py-1 text-sm"
    >
      {isFolder && (
        <>
          <button
            onClick={() => {
              onUploadFiles((state.target as { folderId: string }).folderId);
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-rp-gray-100 text-rp-gray-700"
          >
            Upload files here…
          </button>
          <button
            onClick={() => {
              onNewSubfolder((state.target as { folderId: string }).folderId);
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-rp-gray-100 text-rp-gray-700"
          >
            New Subfolder
          </button>
        </>
      )}
      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-rp-gray-100 text-rp-gray-700"
      >
        Rename
      </button>
      <button
        onClick={() => {
          onMoveTo();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-rp-gray-100 text-rp-gray-700"
      >
        Move to…
      </button>
      <div className="h-px bg-rp-gray-200 my-1" />
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
      >
        Delete
      </button>
    </div>,
    document.body,
  );
}
