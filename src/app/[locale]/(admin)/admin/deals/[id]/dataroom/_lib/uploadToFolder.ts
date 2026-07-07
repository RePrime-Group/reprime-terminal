import type { SupabaseClient } from '@supabase/supabase-js';
import type { TerminalDDDocument } from '@/lib/types/database';
import { maybeCompressImage } from '@/lib/utils/imageCompression';
import { sha256Hex, storageKeyForHash } from '@/lib/utils/sha256';

// Supabase storage keys reject non-ASCII characters (e.g. "×", emoji, accented
// letters). Replace anything outside [A-Za-z0-9._-] with "_" and collapse runs,
// preserving the extension so MIME sniffing downstream still works.
export function sanitizeStorageName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : '';
  const safeBase = base
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'file';
  const safeExt = ext.replace(/[^A-Za-z0-9.]+/g, '');
  return `${safeBase}${safeExt}`;
}

export interface UploadResult {
  document?: TerminalDDDocument;
  error?: string;
  skipped?: boolean; // true when an identical file (same deal + sha256) already exists
}

// Upload one file into a folder. Returns the inserted document row.
// Appends to the end of the folder's sort_order. display_name defaults to the
// original filename so the admin sees a clean name even though storage uses
// the sanitized one.
export async function uploadFileToFolder(
  supabase: SupabaseClient,
  args: {
    dealId: string;
    folderId: string;
    file: File;
    uploadedBy: string | null;
  },
): Promise<UploadResult> {
  const { dealId, folderId, file, uploadedBy } = args;

  // sha256 of the ORIGINAL file bytes is the dedup key. Skip if this deal
  // already holds the same content.
  const sha256 = await sha256Hex(await file.arrayBuffer());
  const { data: dup } = await supabase
    .from('terminal_dd_documents')
    .select('id')
    .eq('deal_id', dealId)
    .eq('sha256', sha256)
    .limit(1)
    .maybeSingle();
  if (dup) return { skipped: true };

  // Content-addressed storage path (deal/sha256.ext) so Storage never dupes.
  const storagePath = storageKeyForHash(dealId, sha256, file.name);

  // Re-encode large images client-side so the stored object is small enough
  // for Supabase's image-render endpoint and so investor page loads aren't
  // hauling 25-MB originals.
  const toUpload = await maybeCompressImage(file);

  const { error: storageError } = await supabase.storage
    .from('terminal-dd-documents')
    .upload(storagePath, toUpload, {
      upsert: true, // identical bytes reuse the same object
      contentType: toUpload.type || file.type || 'application/octet-stream',
    });

  if (storageError) {
    return { error: `Upload failed: ${storageError.message}` };
  }

  // Determine next sort_order within the target folder.
  const { data: existing } = await supabase
    .from('terminal_dd_documents')
    .select('sort_order')
    .eq('folder_id', folderId);
  const nextOrder = (existing ?? []).reduce(
    (max: number, s: { sort_order: number }) => (s.sort_order > max ? s.sort_order : max),
    -1,
  ) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from('terminal_dd_documents')
    .insert({
      deal_id: dealId,
      folder_id: folderId,
      name: file.name,
      display_name: file.name,
      file_size: String(toUpload.size),
      file_type: toUpload.type || file.type,
      storage_path: storagePath,
      sha256,
      uploaded_by: uploadedBy,
      sort_order: nextOrder,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    // Lost a race to another identical upload (unique deal_id+sha256). The
    // storage object is content-addressed and shared with the winning row, so
    // leave it in place and treat this as a skip.
    if (insertError?.code === '23505') return { skipped: true };
    // Best-effort rollback of the storage object so we don't leak files.
    await supabase.storage.from('terminal-dd-documents').remove([storagePath]);
    return { error: `Failed to save record: ${insertError?.message ?? 'unknown'}` };
  }

  try {
    const { data: dealMeta } = await supabase
      .from('terminal_deals')
      .select('name, status')
      .eq('id', dealId)
      .single();
    if (dealMeta && dealMeta.status !== 'draft' && uploadedBy) {
      await supabase.from('terminal_activity_log').insert({
        user_id: uploadedBy,
        deal_id: dealId,
        action: 'deal_document_uploaded',
        metadata: {
          deal_name: dealMeta.name,
          document_category: 'dataroom',
          document_name: file.name,
        },
      });
    }
  } catch {
    // Activity logging is best-effort; never block the upload flow.
  }

  return { document: inserted as TerminalDDDocument };
}
