'use server';

import { getAdminAuth } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import { sha256Hex, storageKeyForHash } from '@/lib/utils/sha256';
import {
  getConnection,
  getAccessToken,
  downloadFile,
  listSubfolders,
  searchFolders,
  type DriveFolderEntry,
} from '@/lib/google/drive';

// ─────────────────────────────────────────────────────────────────────────────
// Google Drive actions for the admin data room.
//   • getDrivePickerConfig  — is an org account connected + a short-lived token
//   • getDealDriveFolder     — the one folder connected to this deal (if any)
//   • connectDealDriveFolder — connect/replace this deal's watched folder
//   • disconnectDealDriveFolder
//   • importDriveFiles       — copy picked Drive files into a data-room folder
// ─────────────────────────────────────────────────────────────────────────────

export interface DrivePickerConfig {
  connected: boolean;
  token?: string; // short-lived OAuth access token for the Picker
  apiKey?: string;
  appId?: string;
}

// Returns the Picker inputs. `connected: false` means no org account — the UI
// should point the admin to Settings instead of opening the Picker.
export async function getDrivePickerConfig(): Promise<DrivePickerConfig> {
  const auth = await getAdminAuth();
  if (!auth.ok) return { connected: false };

  const conn = await getConnection();
  if (!conn) return { connected: false };

  const token = await getAccessToken();
  // The Picker needs these in the browser, but we return them from this
  // admin-gated action instead of NEXT_PUBLIC so they never reach the public
  // bundle or unauthenticated visitors.
  return {
    connected: true,
    token,
    apiKey: process.env.GOOGLE_PICKER_API_KEY ?? '',
    appId: process.env.GOOGLE_PICKER_APP_ID ?? '',
  };
}

// List subfolders of a Drive folder ('root' for My Drive) for the custom folder
// browser used to connect a folder to the deal.
export async function listDriveFolders(
  parentId: string,
): Promise<{ ok: true; folders: DriveFolderEntry[] } | { ok: false; error: string }> {
  const auth = await getAdminAuth();
  if (!auth.ok) return { ok: false, error: 'Forbidden' };
  const conn = await getConnection();
  if (!conn) return { ok: false, error: 'Google Drive not connected' };
  try {
    const folders = await listSubfolders(parentId || 'root');
    return { ok: true, folders };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed to list folders' };
  }
}

// Search Drive folders by name (across My Drive, Shared with me, Shared Drives).
export async function searchDriveFolders(
  query: string,
): Promise<{ ok: true; folders: DriveFolderEntry[] } | { ok: false; error: string }> {
  const auth = await getAdminAuth();
  if (!auth.ok) return { ok: false, error: 'Forbidden' };
  const conn = await getConnection();
  if (!conn) return { ok: false, error: 'Google Drive not connected' };
  try {
    const folders = await searchFolders(query);
    return { ok: true, folders };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Search failed' };
  }
}

export interface DealDriveFolder {
  drive_folder_id: string;
  drive_folder_name: string;
}

export async function getDealDriveFolder(
  dealId: string,
): Promise<DealDriveFolder | null> {
  const auth = await getAdminAuth();
  if (!auth.ok) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('terminal_deal_drive_folders')
    .select('drive_folder_id, drive_folder_name')
    .eq('deal_id', dealId)
    .maybeSingle();
  return (data as DealDriveFolder | null) ?? null;
}

// Connect (or replace) the single Drive folder watched for this deal.
export async function connectDealDriveFolder(
  dealId: string,
  driveFolderId: string,
  driveFolderName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getAdminAuth();
  if (!auth.ok) return { ok: false, error: 'Forbidden' };
  if (!dealId || !driveFolderId) return { ok: false, error: 'Missing folder' };

  const supabase = createAdminClient();
  const { error } = await supabase.from('terminal_deal_drive_folders').upsert(
    {
      deal_id: dealId,
      drive_folder_id: driveFolderId,
      drive_folder_name: driveFolderName || 'Untitled folder',
      connected_by: auth.user.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'deal_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function disconnectDealDriveFolder(
  dealId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getAdminAuth();
  if (!auth.ok) return { ok: false, error: 'Forbidden' };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('terminal_deal_drive_folders')
    .delete()
    .eq('deal_id', dealId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { name: string; error: string }[];
}

// Copy the given Drive file ids into a data-room folder. Downloads bytes
// server-side (native Google docs export to PDF), uploads to the same bucket /
// key convention as manual uploads, then inserts terminal_dd_documents rows.
export async function importDriveFiles(
  dealId: string,
  targetFolderId: string,
  fileIds: string[],
): Promise<ImportResult> {
  const auth = await getAdminAuth();
  if (!auth.ok) return { imported: 0, skipped: 0, errors: [{ name: '—', error: 'Forbidden' }] };
  if (!dealId || !targetFolderId || fileIds.length === 0) {
    return { imported: 0, skipped: 0, errors: [{ name: '—', error: 'Nothing to import' }] };
  }

  const conn = await getConnection();
  if (!conn) {
    return { imported: 0, skipped: 0, errors: [{ name: '—', error: 'Google Drive not connected' }] };
  }

  const supabase = createAdminClient();

  // Next sort_order within the target folder (append to the end).
  const { data: existing } = await supabase
    .from('terminal_dd_documents')
    .select('sort_order')
    .eq('folder_id', targetFolderId);
  let nextOrder =
    (existing ?? []).reduce(
      (max: number, s: { sort_order: number }) => (s.sort_order > max ? s.sort_order : max),
      -1,
    ) + 1;

  const errors: { name: string; error: string }[] = [];
  let imported = 0;
  let skipped = 0;

  for (const fileId of fileIds) {
    let displayName = fileId;
    try {
      const { buffer, filename, mimeType } = await downloadFile(fileId);
      displayName = filename;

      // Dedup on the downloaded bytes: skip if this deal already has the file.
      const sha256 = await sha256Hex(buffer);
      const { data: dup } = await supabase
        .from('terminal_dd_documents')
        .select('id')
        .eq('deal_id', dealId)
        .eq('sha256', sha256)
        .limit(1)
        .maybeSingle();
      if (dup) {
        skipped += 1;
        continue;
      }

      const storagePath = storageKeyForHash(dealId, sha256, filename);

      const { error: storageError } = await supabase.storage
        .from('terminal-dd-documents')
        .upload(storagePath, buffer, { upsert: true, contentType: mimeType });
      if (storageError) {
        errors.push({ name: filename, error: storageError.message });
        continue;
      }

      const { error: insertError } = await supabase.from('terminal_dd_documents').insert({
        deal_id: dealId,
        folder_id: targetFolderId,
        name: filename,
        display_name: filename,
        file_size: String(buffer.length),
        file_type: mimeType,
        storage_path: storagePath,
        sha256,
        uploaded_by: auth.user.userId,
        sort_order: nextOrder,
      });
      if (insertError) {
        // Race lost to an identical upload (unique deal_id+sha256): the shared,
        // content-addressed object stays; count this as a skip.
        if ((insertError as { code?: string }).code === '23505') {
          skipped += 1;
          continue;
        }
        // Roll back the orphaned storage object.
        await supabase.storage.from('terminal-dd-documents').remove([storagePath]);
        errors.push({ name: filename, error: insertError.message });
        continue;
      }

      nextOrder += 1;
      imported += 1;
    } catch (e) {
      errors.push({ name: displayName, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { imported, skipped, errors };
}
