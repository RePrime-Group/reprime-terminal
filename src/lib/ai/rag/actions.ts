'use server';

import { createAdminClient } from '@/lib/supabase/admin';

// Deal-level doc slots (OM/LOI/PSA/...) mirrored into terminal_dd_documents
// so RAG can chunk and cite them. Slot identity is the fixed kebab `name`;
// uniqueness is enforced by terminal_dd_documents_deal_name_unique on
// (deal_id, name). Per-address OM uses 'offering-memorandum-<8-char-prefix>'.

export type DealDocSlot =
  | 'offering-memorandum'
  | 'loi-signed'
  | 'purchase-sale-agreement'
  | 'full-report'
  | 'costar-report'
  | 'tenants-report'
  | 'lease-summary';

function slotName(slot: DealDocSlot, addressId?: string | null): string {
  if (slot === 'offering-memorandum' && addressId) {
    return `offering-memorandum-${addressId.slice(0, 8)}`;
  }
  return slot;
}

interface PromoteArgs {
  dealId: string;
  storagePath: string;
  slot: DealDocSlot;
  displayName: string;
  fileType: string | null;
  fileSize: number | null;
  sha256?: string | null;
  addressId?: string | null;
  uploadedBy?: string | null;
}

export async function promoteDealDocAction(args: PromoteArgs): Promise<void> {
  const { dealId, storagePath, slot, displayName, fileType, fileSize, sha256, addressId, uploadedBy } = args;
  if (!dealId || !storagePath || !slot) return;

  const admin = createAdminClient();
  const name = slotName(slot, addressId);

  // Delete the previous row for this slot. Chunks cascade via FK.
  await admin
    .from('terminal_dd_documents')
    .delete()
    .eq('deal_id', dealId)
    .eq('name', name);

  // Dedup: if the same bytes already exist for this deal (e.g. the file was also
  // uploaded into a data-room folder), the (deal_id, sha256) unique index would
  // reject our insert. The slot doc wins — delete the other copy first.
  if (sha256) {
    await admin
      .from('terminal_dd_documents')
      .delete()
      .eq('deal_id', dealId)
      .eq('sha256', sha256);
  }

  const { error } = await admin
    .from('terminal_dd_documents')
    .insert({
      deal_id: dealId,
      folder_id: null,
      name,
      display_name: displayName,
      file_type: fileType,
      file_size: fileSize !== null && fileSize !== undefined ? String(fileSize) : null,
      storage_path: storagePath,
      sha256: sha256 ?? null,
      uploaded_by: uploadedBy ?? null,
      indexing_status: 'pending',
    });

  if (error) {
    console.error('[rag] promoteDealDocAction insert failed', { dealId, slot, error });
  }
}

interface RemoveArgs {
  dealId: string;
  slot: DealDocSlot;
  addressId?: string | null;
}

export async function removeDealDocAction(args: RemoveArgs): Promise<void> {
  const { dealId, slot, addressId } = args;
  if (!dealId || !slot) return;

  const admin = createAdminClient();
  const name = slotName(slot, addressId);
  const { error } = await admin
    .from('terminal_dd_documents')
    .delete()
    .eq('deal_id', dealId)
    .eq('name', name);
  if (error) console.error('[rag] removeDealDocAction failed', { dealId, slot, error });
}
