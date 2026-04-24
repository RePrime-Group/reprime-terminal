'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TerminalDDFolder, TerminalDDDocument, DataRoomFolderNode } from '@/lib/types/database';
import { buildTree, flattenFolders } from '../_lib/tree';
import { dataRoomApi } from '../_lib/api';
import { uploadFileToFolder } from '../_lib/uploadToFolder';

// Central state for the admin data room. Everything that reads or writes
// folders/documents goes through this hook so optimistic updates and rollback
// stay consistent across the tree.
export function useDataRoom(dealId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [folders, setFolders] = useState<TerminalDDFolder[]>([]);
  const [documents, setDocuments] = useState<TerminalDDDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Subscription effect: whenever dealId changes or refresh() is called
  // (via incrementing refreshToken), re-fetch folders + documents from the
  // external system (Supabase) and mirror into React state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [foldersRes, docsRes, userRes] = await Promise.all([
        supabase.from('terminal_dd_folders').select('*').eq('deal_id', dealId),
        supabase.from('terminal_dd_documents').select('*').eq('deal_id', dealId),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      if (foldersRes.data) setFolders(foldersRes.data as TerminalDDFolder[]);
      if (docsRes.data) setDocuments(docsRes.data as TerminalDDDocument[]);
      if (userRes.data.user) setUserId(userRes.data.user.id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, dealId, refreshToken]);

  const refresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  const tree = useMemo(() => buildTree(folders, documents), [folders, documents]);

  // ── Folder mutations ──────────────────────────────────────────────────────

  const createFolder = useCallback(
    async (args: { name: string; icon?: string | null; parent_id?: string | null }) => {
      try {
        const folder = await dataRoomApi.createFolder({ deal_id: dealId, ...args });
        setFolders((prev) => [...prev, folder]);
        return folder;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      }
    },
    [dealId],
  );

  const renameFolder = useCallback(async (id: string, name: string) => {
    const snapshot = folders;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
    try {
      await dataRoomApi.updateFolder(id, { name });
    } catch (e) {
      setFolders(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [folders]);

  const updateFolderIcon = useCallback(async (id: string, icon: string | null) => {
    const snapshot = folders;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, icon } : f)));
    try {
      await dataRoomApi.updateFolder(id, { icon });
    } catch (e) {
      setFolders(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [folders]);

  const moveFolder = useCallback(async (id: string, parent_id: string | null) => {
    const snapshot = folders;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, parent_id } : f)));
    try {
      const updated = await dataRoomApi.updateFolder(id, { parent_id });
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (e) {
      setFolders(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [folders]);

  const deleteFolder = useCallback(async (id: string, mode: 'cascade' | 'reparent') => {
    const folderSnapshot = folders;
    const docSnapshot = documents;

    // Pre-compute subtree so optimistic update is accurate.
    const flat = flattenFolders(buildTree(folders, documents));
    const target = flat.find((f) => f.id === id);
    if (!target) return;
    const collectIds = (node: DataRoomFolderNode): string[] => {
      const ids = [node.id];
      for (const c of node.children) ids.push(...collectIds(c));
      return ids;
    };
    const subtreeIds = collectIds(target);

    if (mode === 'cascade') {
      setFolders((prev) => prev.filter((f) => !subtreeIds.includes(f.id)));
      setDocuments((prev) => prev.filter((d) => !subtreeIds.includes(d.folder_id)));
    } else {
      // reparent: direct children take this folder's parent_id, docs go to parent
      if (target.parent_id === null) {
        setError('Cannot reparent contents of a root folder');
        return;
      }
      const newParent: string | null = target.parent_id;
      setFolders((prev) =>
        prev
          .filter((f) => f.id !== id)
          .map((f) => (f.parent_id === id ? { ...f, parent_id: newParent } : f)),
      );
      setDocuments((prev) =>
        prev.map((d) => (d.folder_id === id ? { ...d, folder_id: newParent! } : d)),
      );
    }

    try {
      await dataRoomApi.deleteFolder(id, mode);
    } catch (e) {
      setFolders(folderSnapshot);
      setDocuments(docSnapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [folders, documents]);

  const reorderFolders = useCallback(async (orderedIds: string[]) => {
    const snapshot = folders;
    // Optimistic: set display_order = index within the sibling set.
    setFolders((prev) =>
      prev.map((f) => {
        const i = orderedIds.indexOf(f.id);
        return i === -1 ? f : { ...f, display_order: i };
      }),
    );
    try {
      await dataRoomApi.reorder({ type: 'folder', ordered_ids: orderedIds });
    } catch (e) {
      setFolders(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [folders]);

  // ── Document mutations ────────────────────────────────────────────────────

  const uploadFile = useCallback(
    async (folderId: string, file: File) => {
      const { document, error } = await uploadFileToFolder(supabase, {
        dealId,
        folderId,
        file,
        uploadedBy: userId,
      });
      if (error) {
        setError(error);
        return null;
      }
      if (document) {
        setDocuments((prev) => [...prev, document]);
      }
      return document ?? null;
    },
    [supabase, dealId, userId],
  );

  const renameDocument = useCallback(async (id: string, display_name: string) => {
    const snapshot = documents;
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, display_name } : d)));
    try {
      await dataRoomApi.updateDocument(id, { display_name });
    } catch (e) {
      setDocuments(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [documents]);

  const moveDocument = useCallback(async (id: string, folder_id: string) => {
    const snapshot = documents;
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, folder_id } : d)));
    try {
      const updated = await dataRoomApi.updateDocument(id, { folder_id });
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (e) {
      setDocuments(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [documents]);

  const deleteDocument = useCallback(async (id: string) => {
    const snapshot = documents;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    try {
      await dataRoomApi.deleteDocument(id);
    } catch (e) {
      setDocuments(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [documents]);

  const reorderDocuments = useCallback(
    async (folderId: string, orderedIds: string[]) => {
      const snapshot = documents;
      setDocuments((prev) =>
        prev.map((d) => {
          if (d.folder_id !== folderId) return d;
          const i = orderedIds.indexOf(d.id);
          return i === -1 ? d : { ...d, sort_order: i };
        }),
      );
      try {
        await dataRoomApi.reorder({ type: 'document', folder_id: folderId, ordered_ids: orderedIds });
      } catch (e) {
        setDocuments(snapshot);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [documents],
  );

  const bulkMoveDocuments = useCallback(
    async (documentIds: string[], targetFolderId: string) => {
      const snapshot = documents;
      setDocuments((prev) =>
        prev.map((d) => (documentIds.includes(d.id) ? { ...d, folder_id: targetFolderId } : d)),
      );
      try {
        await dataRoomApi.bulkDocuments({
          action: 'move',
          document_ids: documentIds,
          target_folder_id: targetFolderId,
        });
      } catch (e) {
        setDocuments(snapshot);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [documents],
  );

  const bulkDeleteDocuments = useCallback(async (documentIds: string[]) => {
    const snapshot = documents;
    setDocuments((prev) => prev.filter((d) => !documentIds.includes(d.id)));
    try {
      await dataRoomApi.bulkDocuments({ action: 'delete', document_ids: documentIds });
    } catch (e) {
      setDocuments(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [documents]);

  return {
    userId,
    loading,
    error,
    setError,
    folders,
    documents,
    tree,
    refresh,
    // folders
    createFolder,
    renameFolder,
    updateFolderIcon,
    moveFolder,
    deleteFolder,
    reorderFolders,
    // documents
    uploadFile,
    renameDocument,
    moveDocument,
    deleteDocument,
    reorderDocuments,
    bulkMoveDocuments,
    bulkDeleteDocuments,
  };
}

export type DataRoomHook = ReturnType<typeof useDataRoom>;
