'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import DealSubNav from '@/components/admin/DealSubNav';
import { createClient } from '@/lib/supabase/client';
import { useDataRoom } from '../_hooks/useDataRoom';
import { useSelection } from '../_hooks/useSelection';
import { DataRoomProvider } from './DataRoomContext';
import { Toolbar } from './Toolbar';
import { BulkBar } from './BulkBar';
import { FolderNode } from './Nodes';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import {
  CreateFolderModal,
  DeleteFolderModal,
  DeleteDocumentModal,
  MoveToModal,
} from './Modals';
import { ZipExtractModal } from './ZipExtractModal';
import { findNode, flattenFolders, wouldCreateCircle } from '../_lib/tree';

interface Props {
  dealId: string;
  dealName: string;
  locale: string;
}

// Microsoft Office Online and Google Docs viewer fallbacks for non-PDF formats
// browsers can't render natively. PDFs go straight through the download
// endpoint (which watermarks them server-side).
const OFFICE_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.docx', '.doc', '.docm', '.pptx', '.ppt', '.pptm'];
const GVIEW_EXTENSIONS = ['.tif', '.tiff', '.heic', '.heif'];

export default function DataRoomClient({ dealId, dealName, locale }: Props) {
  const data = useDataRoom(dealId);
  const selection = useSelection();

  // UI state (non-data)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [notifyOnUpload, setNotifyOnUpload] = useState(false);
  const [notifyToast, setNotifyToast] = useState<string | null>(null);

  // Modals
  const [createFolderParent, setCreateFolderParent] = useState<{ open: boolean; parentId: string | null }>({ open: false, parentId: null });
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<{ open: boolean; docIds: string[]; folderId?: string | null }>({ open: false, docIds: [] });
  const [zipModal, setZipModal] = useState<{ open: boolean; storagePath: string | null; targetFolderId: string | null }>({ open: false, storagePath: null, targetFolderId: null });

  // Document preview viewer (mirrors investor-side behaviour: PDFs render in
  // an iframe via the download endpoint; Office files go through Microsoft
  // Office Online; TIFF/HEIC fall back to Google Docs viewer).
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState<string>('');
  const handleViewDocument = useCallback(
    async (docId: string, displayName: string, storagePath: string | null) => {
      const lower = displayName.toLowerCase();
      const isOfficeFile = OFFICE_EXTENSIONS.some((ext) => lower.endsWith(ext));
      const isGViewFile = GVIEW_EXTENSIONS.some((ext) => lower.endsWith(ext));
      const fallback = `/api/documents/${docId}/download?view=true`;
      if ((isOfficeFile || isGViewFile) && storagePath) {
        const supabase = createClient();
        const { data: signed } = await supabase.storage
          .from('terminal-dd-documents')
          .createSignedUrl(storagePath, 300);
        if (signed?.signedUrl) {
          const encoded = encodeURIComponent(signed.signedUrl);
          setViewerUrl(
            isOfficeFile
              ? `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`
              : `https://docs.google.com/gview?url=${encoded}&embedded=true`,
          );
        } else {
          setViewerUrl(fallback);
        }
      } else {
        setViewerUrl(fallback);
      }
      setViewerName(displayName);
    },
    [],
  );

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeDrag, setActiveDrag] = useState<{ type: 'folder' | 'document'; label: string } | null>(null);

  // Hidden file input for the "Upload files here" context-menu action.
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetFolder, setUploadTargetFolder] = useState<string | null>(null);

  const triggerUploadPicker = useCallback((folderId: string) => {
    setUploadTargetFolder(folderId);
    // Defer so the file input is mounted with the correct target before clicking.
    setTimeout(() => uploadInputRef.current?.click(), 0);
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandFolder = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Expand ancestors when anything is new/moved to make them visible.
  const expandAncestors = useCallback(
    (folderId: string) => {
      const flat = flattenFolders(data.tree);
      const byId = new Map(flat.map((f) => [f.id, f]));
      let cursor: string | null | undefined = folderId;
      const toAdd = new Set<string>();
      while (cursor) {
        toAdd.add(cursor);
        cursor = byId.get(cursor)?.parent_id;
      }
      setExpanded((prev) => new Set([...prev, ...toAdd]));
    },
    [data.tree],
  );

  // ── Upload handling ──────────────────────────────────────────────────────

  const notifyInvestors = useCallback(
    async (fileNames: string[]) => {
      try {
        const res = await fetch(`/api/admin/deals/${dealId}/notify-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'document_upload', docNames: fileNames }),
        });
        if (res.ok) {
          const body = await res.json().catch(() => ({}));
          const sent = typeof body.sent === 'number' ? body.sent : 0;
          setNotifyToast(
            sent > 0
              ? `Notified ${sent} investor${sent === 1 ? '' : 's'}.`
              : 'No NDA-signed investors to notify.',
          );
        } else {
          setNotifyToast('Upload succeeded, but notification failed.');
        }
      } catch {
        setNotifyToast('Upload succeeded, but notification failed.');
      }
      setTimeout(() => setNotifyToast(null), 4000);
    },
    [dealId],
  );

  const handleUpload = useCallback(
    async (folderId: string, files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const uploadedNames: string[] = [];
      for (const file of list) {
        const doc = await data.uploadFile(folderId, file);
        if (doc) uploadedNames.push(doc.display_name ?? doc.name);

        // ZIP files trigger extract modal after the upload finishes.
        const isZip =
          file.type === 'application/zip' ||
          file.type === 'application/x-zip-compressed' ||
          file.type === 'application/x-zip' ||
          file.name.toLowerCase().endsWith('.zip');
        if (isZip && doc?.storage_path) {
          setZipModal({ open: true, storagePath: doc.storage_path, targetFolderId: folderId });
        }
      }

      if (notifyOnUpload && uploadedNames.length > 0) {
        await notifyInvestors(uploadedNames);
      }
    },
    [data, notifyOnUpload, notifyInvestors],
  );

  // ── DnD handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const d = event.active.data.current;
    if (!d) return;
    if (d.type === 'folder') {
      const node = findNode(data.tree, d.folderId);
      setActiveDrag({ type: 'folder', label: node ? node.name : 'Folder' });
    } else if (d.type === 'document') {
      const doc = data.documents.find((x) => x.id === d.docId);
      setActiveDrag({ type: 'document', label: doc ? (doc.display_name ?? doc.name) : 'File' });
    }
  }, [data.tree, data.documents]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;
      if (!activeData || !overData || overData.type !== 'folder') return;

      const targetFolderId = overData.folderId as string;

      if (activeData.type === 'document') {
        const docId = activeData.docId as string;
        const doc = data.documents.find((d) => d.id === docId);
        if (!doc || doc.folder_id === targetFolderId) return;
        await data.moveDocument(docId, targetFolderId);
        expandFolder(targetFolderId);
      } else if (activeData.type === 'folder') {
        const folderId = activeData.folderId as string;
        if (folderId === targetFolderId) return;
        const flat = flattenFolders(data.tree);
        if (wouldCreateCircle(folderId, targetFolderId, flat)) return;
        const current = flat.find((f) => f.id === folderId);
        if (!current || current.parent_id === targetFolderId) return;
        await data.moveFolder(folderId, targetFolderId);
        expandFolder(targetFolderId);
      }
    },
    [data, expandFolder],
  );

  // ── Context menu actions ─────────────────────────────────────────────────

  const handleContextMenu = useCallback(
    (x: number, y: number, target: ContextMenuState['target']) => {
      setContextMenu({ x, y, target });
    },
    [],
  );

  // ── Bulk actions ─────────────────────────────────────────────────────────

  const handleBulkDownload = useCallback(() => {
    const ids = [...selection.selectedDocIds];
    if (ids.length === 0) return;
    window.location.href = `/api/deals/${dealId}/package?docs=${ids.join(',')}`;
  }, [dealId, selection.selectedDocIds]);

  const handleBulkDelete = useCallback(async () => {
    const ids = [...selection.selectedDocIds];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} file${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    await data.bulkDeleteDocuments(ids);
    selection.clear();
  }, [data, selection]);

  const handleBulkMove = useCallback(() => {
    setMoveModal({ open: true, docIds: [...selection.selectedDocIds] });
  }, [selection.selectedDocIds]);

  // ── Folder delete confirmation ───────────────────────────────────────────

  const deleteFolderTarget = deleteFolderId ? findNode(data.tree, deleteFolderId) : null;

  const contextValue = useMemo(
    () => ({
      dealId,
      data,
      selection,
      expandedFolders: expanded,
      toggleExpanded,
      expandFolder,
      editingFolderId,
      setEditingFolderId,
      editingDocId,
      setEditingDocId,
      onRequestDeleteFolder: (id: string) => setDeleteFolderId(id),
      onRequestDeleteDoc: (id: string) => setDeleteDocId(id),
      onRequestMoveDocs: (ids: string[]) => setMoveModal({ open: true, docIds: ids }),
      onRequestNewSubfolder: (parentId: string) =>
        setCreateFolderParent({ open: true, parentId }),
      onUploadFiles: handleUpload,
      onViewDocument: handleViewDocument,
      onContextMenu: handleContextMenu,
    }),
    [
      dealId, data, selection, expanded, toggleExpanded, expandFolder,
      editingFolderId, editingDocId, handleUpload, handleViewDocument, handleContextMenu,
    ],
  );

  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-rp-gray-400 text-sm">Loading data room…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <DealSubNav dealId={dealId} dealName={dealName || 'Deal'} locale={locale} />

      <DataRoomProvider value={contextValue}>
        <Toolbar
          dealId={dealId}
          dealName={dealName}
          userId={data.userId}
          uploading={false}
          notifyOnUpload={notifyOnUpload}
          onToggleNotify={() => setNotifyOnUpload((v) => !v)}
          onNewFolder={() => setCreateFolderParent({ open: true, parentId: null })}
          onRefresh={data.refresh}
        />

        {notifyToast && (
          <div className="mb-3 px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[12px] text-emerald-800">
            {notifyToast}
          </div>
        )}

        {data.error && (
          <div className="mb-3 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-center justify-between">
            <span>{data.error}</span>
            <button
              onClick={() => data.setError(null)}
              className="text-red-700 hover:text-red-900 font-semibold"
            >
              ×
            </button>
          </div>
        )}

        <BulkBar
          count={selection.count}
          onMove={handleBulkMove}
          onDelete={handleBulkDelete}
          onDownload={handleBulkDownload}
          onClear={() => selection.clear()}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          {/* Tree */}
          <div
            className="bg-white rounded-xl border border-rp-gray-200 p-2 shadow-sm"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              // Desktop file drop on the tree container (not on a specific folder)
              // falls through to the first root folder if any. Per-folder drop
              // is handled by FolderNode's own dragover/drop.
              e.preventDefault();
              if (e.dataTransfer.files.length === 0) return;
              const roots = data.tree;
              if (roots.length === 0) return;
              await handleUpload(roots[0].id, e.dataTransfer.files);
            }}
          >
            {data.tree.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-rp-gray-500">No folders yet.</p>
                <p className="text-xs text-rp-gray-400 mt-1">
                  Click &quot;+ New Folder&quot; to get started, or &quot;⚡ Create DD Folders&quot; to seed the standard structure.
                </p>
              </div>
            ) : (
              data.tree.map((node) => (
                <FolderNode key={node.id} node={node} depth={0} />
              ))
            )}
          </div>

          <DragOverlay>
            {activeDrag && (
              <div className="px-3 py-1.5 bg-white border border-rp-gold rounded-lg shadow-lg text-sm text-rp-navy font-medium">
                {activeDrag.label}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* ── Modals ───────────────────────────────────────── */}

        <CreateFolderModal
          isOpen={createFolderParent.open}
          parentName={
            createFolderParent.parentId
              ? findNode(data.tree, createFolderParent.parentId)?.name ?? null
              : null
          }
          onClose={() => setCreateFolderParent({ open: false, parentId: null })}
          onCreate={async (name) => {
            const folder = await data.createFolder({
              name,
              icon: null,
              parent_id: createFolderParent.parentId,
            });
            if (createFolderParent.parentId) expandFolder(createFolderParent.parentId);
            expandFolder(folder.id);
          }}
        />

        <DeleteFolderModal
          isOpen={!!deleteFolderId}
          folder={deleteFolderTarget}
          onClose={() => setDeleteFolderId(null)}
          onConfirm={async (mode) => {
            if (deleteFolderId) await data.deleteFolder(deleteFolderId, mode);
          }}
        />

        <DeleteDocumentModal
          isOpen={!!deleteDocId}
          document={deleteDocId ? data.documents.find((d) => d.id === deleteDocId) ?? null : null}
          onClose={() => setDeleteDocId(null)}
          onConfirm={async () => {
            if (deleteDocId) {
              await data.deleteDocument(deleteDocId);
              selection.deselectMany([deleteDocId]);
            }
          }}
        />

        <MoveToModal
          isOpen={moveModal.open}
          tree={data.tree}
          excludeFolderId={moveModal.folderId ?? null}
          onClose={() => setMoveModal({ open: false, docIds: [] })}
          onConfirm={async (targetFolderId) => {
            if (moveModal.folderId) {
              // Folder move
              await data.moveFolder(moveModal.folderId, targetFolderId);
              expandFolder(targetFolderId);
            } else {
              // Document(s) move
              if (moveModal.docIds.length === 1) {
                await data.moveDocument(moveModal.docIds[0], targetFolderId);
              } else {
                await data.bulkMoveDocuments(moveModal.docIds, targetFolderId);
              }
              selection.clear();
              expandFolder(targetFolderId);
            }
          }}
        />

        <ZipExtractModal
          isOpen={zipModal.open}
          dealId={dealId}
          storagePath={zipModal.storagePath}
          targetFolderId={zipModal.targetFolderId}
          onClose={() => setZipModal({ open: false, storagePath: null, targetFolderId: null })}
          onAfterRefresh={async () => {
            await data.refresh();
            if (zipModal.targetFolderId) expandAncestors(zipModal.targetFolderId);
          }}
        />

        {/* Context menu */}
        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onUploadFiles={triggerUploadPicker}
          onNewSubfolder={(parentId) => setCreateFolderParent({ open: true, parentId })}
          onRename={() => {
            if (!contextMenu) return;
            if (contextMenu.target.type === 'folder') setEditingFolderId(contextMenu.target.folderId);
            else setEditingDocId(contextMenu.target.docId);
          }}
          onMoveTo={() => {
            if (!contextMenu) return;
            if (contextMenu.target.type === 'folder') {
              // Folder move: use docIds empty, stash the folderId
              setMoveModal({ open: true, docIds: [], folderId: contextMenu.target.folderId });
            } else {
              setMoveModal({ open: true, docIds: [contextMenu.target.docId] });
            }
          }}
          onDelete={() => {
            if (!contextMenu) return;
            if (contextMenu.target.type === 'folder') setDeleteFolderId(contextMenu.target.folderId);
            else setDeleteDocId(contextMenu.target.docId);
          }}
        />

        {/* Hidden file picker for "Upload files here" context action */}
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = e.target.files;
            if (files && files.length > 0 && uploadTargetFolder) {
              await handleUpload(uploadTargetFolder, files);
              expandFolder(uploadTargetFolder);
            }
            if (uploadInputRef.current) uploadInputRef.current.value = '';
            setUploadTargetFolder(null);
          }}
        />

        {/* ── Document Viewer Modal ── */}
        {viewerUrl && (
          <div
            className="fixed inset-0 z-[100] flex items-stretch md:items-center justify-center bg-black/80 backdrop-blur-md md:p-4"
            onClick={() => setViewerUrl(null)}
          >
            <div
              className="relative bg-white md:rounded-2xl overflow-hidden flex flex-col w-full h-full md:w-[90vw] md:h-[92vh] md:max-w-[1200px]"
              style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.4)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 shrink-0 gap-3"
                style={{ background: 'linear-gradient(135deg, #0E3470, #0a2450)', borderBottom: '2px solid #BC9C45' }}
              >
                <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#BC9C45]/15 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white text-[13px] md:text-[14px] font-semibold truncate">{viewerName}</div>
                  </div>
                </div>
                <button
                  onClick={() => setViewerUrl(null)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 relative bg-[#1a1a2e]">
                <iframe
                  src={viewerUrl}
                  className="w-full h-full border-0"
                  title={viewerName}
                />
              </div>
            </div>
          </div>
        )}
      </DataRoomProvider>
    </div>
  );
}
