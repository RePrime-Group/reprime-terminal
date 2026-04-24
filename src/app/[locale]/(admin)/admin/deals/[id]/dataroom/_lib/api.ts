import type { TerminalDDFolder, TerminalDDDocument } from '@/lib/types/database';

// Thin fetch() wrappers around the /api/dataroom/* routes. Throws on non-2xx
// so callers can surface the error message.

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Request failed with ${res.status}`);
  }
  return body as T;
}

export const dataRoomApi = {
  createFolder: async (args: {
    deal_id: string;
    name: string;
    icon?: string | null;
    parent_id?: string | null;
  }): Promise<TerminalDDFolder> => {
    const res = await fetch('/api/dataroom/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return (await jsonOrThrow<{ folder: TerminalDDFolder }>(res)).folder;
  },

  updateFolder: async (
    id: string,
    patch: { name?: string; icon?: string | null; parent_id?: string | null },
  ): Promise<TerminalDDFolder> => {
    const res = await fetch(`/api/dataroom/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return (await jsonOrThrow<{ folder: TerminalDDFolder }>(res)).folder;
  },

  deleteFolder: async (id: string, mode: 'cascade' | 'reparent'): Promise<void> => {
    const res = await fetch(`/api/dataroom/folders/${id}?mode=${mode}`, {
      method: 'DELETE',
    });
    await jsonOrThrow<{ success: true }>(res);
  },

  updateDocument: async (
    id: string,
    patch: {
      display_name?: string;
      folder_id?: string;
      is_downloadable?: boolean;
      doc_status?: string;
    },
  ): Promise<TerminalDDDocument> => {
    const res = await fetch(`/api/dataroom/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return (await jsonOrThrow<{ document: TerminalDDDocument }>(res)).document;
  },

  deleteDocument: async (id: string): Promise<void> => {
    const res = await fetch(`/api/dataroom/documents/${id}`, { method: 'DELETE' });
    await jsonOrThrow<{ success: true }>(res);
  },

  reorder: async (
    args:
      | { type: 'folder'; ordered_ids: string[] }
      | { type: 'document'; folder_id: string; ordered_ids: string[] },
  ): Promise<void> => {
    const res = await fetch('/api/dataroom/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    await jsonOrThrow<{ success: true }>(res);
  },

  bulkDocuments: async (
    args:
      | { action: 'move'; document_ids: string[]; target_folder_id: string }
      | { action: 'delete'; document_ids: string[] },
  ): Promise<void> => {
    const res = await fetch('/api/dataroom/documents/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    await jsonOrThrow<{ success: true }>(res);
  },
};
