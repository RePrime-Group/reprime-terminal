'use client';

import { createContext, useContext, ReactNode } from 'react';
import type { DataRoomHook } from '../_hooks/useDataRoom';
import type { SelectionHook } from '../_hooks/useSelection';

interface DataRoomContextValue {
  dealId: string;
  data: DataRoomHook;
  selection: SelectionHook;
  expandedFolders: Set<string>;
  toggleExpanded: (id: string) => void;
  expandFolder: (id: string) => void;
  editingFolderId: string | null;
  setEditingFolderId: (id: string | null) => void;
  editingDocId: string | null;
  setEditingDocId: (id: string | null) => void;
  onRequestDeleteFolder: (id: string) => void;
  onRequestDeleteDoc: (id: string) => void;
  onRequestMoveDocs: (ids: string[]) => void;
  onRequestNewSubfolder: (parentId: string) => void;
  onUploadFiles: (folderId: string, files: FileList | File[]) => void;
  onViewDocument: (docId: string, displayName: string, storagePath: string | null) => void;
  onContextMenu: (
    x: number,
    y: number,
    target: { type: 'folder'; folderId: string } | { type: 'document'; docId: string },
  ) => void;
}

const Ctx = createContext<DataRoomContextValue | null>(null);

export function DataRoomProvider({
  value,
  children,
}: {
  value: DataRoomContextValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDataRoomContext(): DataRoomContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDataRoomContext must be used inside DataRoomProvider');
  return ctx;
}
