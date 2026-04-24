'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { DataRoomFolderNode, TerminalDDDocument } from '@/lib/types/database';
import { flattenFolders, wouldCreateCircle, countAllDocs, findPath } from '../_lib/tree';

// ─────────────────────────────────────────────────────────────────────────────
// Create Folder — reused for top-level and subfolder creation.
// The icon column on terminal_dd_folders is ignored by the UI now (single
// FolderIcon glyph for every folder); kept as a nullable column for data
// that may have been seeded with emojis.
// ─────────────────────────────────────────────────────────────────────────────

export function CreateFolderModal({
  isOpen,
  parentName,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  parentName: string | null; // null = top-level, string = "Under 'Leases'"
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onCreate(trimmed);
      setName('');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={parentName ? `New Subfolder in "${parentName}"` : 'New Folder'}
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Folder name"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') onClose();
        }}
        className="w-full rounded-lg border border-rp-gray-300 px-3 py-2 text-sm outline-none focus:border-rp-gold transition-colors mb-4"
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="gold" size="sm" onClick={handleSave} loading={saving} disabled={!name.trim()}>
          Create
        </Button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Folder — two modes when non-empty (reparent vs cascade)
// ─────────────────────────────────────────────────────────────────────────────

export function DeleteFolderModal({
  isOpen,
  folder,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  folder: DataRoomFolderNode | null;
  onClose: () => void;
  onConfirm: (mode: 'cascade' | 'reparent') => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!folder) return null;

  const docCount = countAllDocs(folder);
  const childCount = folder.children.length;
  const isEmpty = docCount === 0 && childCount === 0;
  const canReparent = folder.parent_id !== null;

  async function run(mode: 'cascade' | 'reparent') {
    setBusy(true);
    try {
      await onConfirm(mode);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Folder">
      <p className="text-sm text-rp-gray-600 mb-2">
        Delete <span className="font-semibold text-rp-navy">{folder.name}</span>?
      </p>

      {isEmpty ? (
        <>
          <p className="text-xs text-rp-gray-400 mb-5">This folder is empty.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => run('cascade')} loading={busy}>
              Delete
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-rp-gray-500 mb-4">
            This folder contains {docCount} file{docCount === 1 ? '' : 's'}
            {childCount > 0 && ` and ${childCount} subfolder${childCount === 1 ? '' : 's'}`}.
          </p>
          <div className="flex flex-col gap-2">
            {canReparent && (
              <button
                disabled={busy}
                onClick={() => run('reparent')}
                className="w-full text-left px-4 py-3 rounded-lg border border-rp-gray-200 hover:border-rp-gold hover:bg-rp-gold/5 transition-all disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-rp-navy">Move contents to parent folder</div>
                <div className="text-xs text-rp-gray-500 mt-0.5">Safe — keeps every file and subfolder.</div>
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => run('cascade')}
              className="w-full text-left px-4 py-3 rounded-lg border border-red-200 hover:border-red-400 hover:bg-red-50 transition-all disabled:opacity-50"
            >
              <div className="text-sm font-semibold text-red-600">Delete folder and all contents</div>
              <div className="text-xs text-red-500/80 mt-0.5">Removes every file and subfolder — cannot be undone.</div>
            </button>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Document
// ─────────────────────────────────────────────────────────────────────────────

export function DeleteDocumentModal({
  isOpen,
  document: doc,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  document: TerminalDDDocument | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  async function run() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Document">
      <p className="text-sm text-rp-gray-600 mb-6">
        Delete <span className="font-semibold text-rp-navy">{doc.display_name ?? doc.name}</span>?
        This cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="danger" size="sm" onClick={run} loading={busy}>Delete</Button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Move To — folder picker. Single-doc or bulk. Optionally supply dragId to
// exclude it + its descendants from the picker (for folder moves).
// ─────────────────────────────────────────────────────────────────────────────

export function MoveToModal({
  isOpen,
  tree,
  excludeFolderId,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  tree: DataRoomFolderNode[];
  excludeFolderId?: string | null;
  onClose: () => void;
  onConfirm: (targetFolderId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const flat = flattenFolders(tree);
  const flatWithPath = flat.map((f) => ({
    id: f.id,
    label: findPath(tree, f.id).map((n) => n.name).join(' → '),
    parent_id: f.parent_id,
  }));

  // If we're moving a folder, exclude it + descendants (would create a cycle).
  const filtered = excludeFolderId
    ? flatWithPath.filter((f) => !wouldCreateCircle(excludeFolderId, f.id, flat))
    : flatWithPath;

  async function run() {
    if (!selected) return;
    setBusy(true);
    try {
      await onConfirm(selected);
      setSelected(null);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move to…">
      <div className="max-h-[280px] overflow-y-auto border border-rp-gray-200 rounded-lg mb-4">
        {filtered.length === 0 ? (
          <p className="text-xs text-rp-gray-400 text-center py-4">No valid destinations.</p>
        ) : (
          filtered.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-rp-gray-100 border-b border-rp-gray-100 last:border-b-0 ${
                selected === f.id ? 'bg-rp-gold/10 text-rp-navy font-medium' : 'text-rp-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="gold" size="sm" onClick={run} loading={busy} disabled={!selected}>Move</Button>
      </div>
    </Modal>
  );
}
