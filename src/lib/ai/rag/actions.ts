'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueIngest } from './enqueueIngest';

// Server Action wrapper so client components can trigger an ingestion enqueue
// without exposing N8N_INGEST_WEBHOOK_URL to the browser. Never throws —
// failures are logged server-side and ignored client-side.
export async function enqueueIngestAction(documentId: string, dealId: string): Promise<void> {
  if (!documentId || !dealId) return;
  await enqueueIngest(documentId, dealId);
}

// Phase 6 Step 7 — deal-level doc slots (OM/LOI/PSA/...) mirrored into
// terminal_dd_documents so RAG can chunk and cite them.

export type DealDocSourceKind =
  | 'deal_om'
  | 'deal_om_address'
  | 'deal_loi'
  | 'deal_psa'
  | 'deal_full_report'
  | 'deal_costar_report'
  | 'deal_tenants_report'
  | 'deal_lease_summary';

interface PromoteArgs {
  dealId: string;
  storagePath: string;
  sourceKind: DealDocSourceKind;
  name: string;
  fileType: string | null;
  fileSize: number | null;
  sourceRef?: string | null;
  uploadedBy?: string | null;
}

// Promote a deal-level slot upload into terminal_dd_documents. Deletes any
// prior row for the same (deal_id, source_kind [, source_ref]) so its chunks
// cascade-delete, then inserts the new row at indexing_status='pending' and
// fires enqueueIngest. Service-role client so it bypasses RLS — the caller
// is trusted admin code that already wrote the storage path to terminal_deals.
export async function promoteDealDocAction(args: PromoteArgs): Promise<void> {
  const { dealId, storagePath, sourceKind, name, fileType, fileSize, sourceRef, uploadedBy } = args;
  if (!dealId || !storagePath || !sourceKind || !name) return;

  const admin = createAdminClient();

  // Delete the previous row for this slot (if any). Chunks cascade via FK.
  let priorQuery = admin
    .from('terminal_dd_documents')
    .delete()
    .eq('deal_id', dealId)
    .eq('source_kind', sourceKind);
  if (sourceKind === 'deal_om_address' && sourceRef) {
    priorQuery = priorQuery.eq('source_ref', sourceRef);
  }
  await priorQuery;

  const { data: inserted, error } = await admin
    .from('terminal_dd_documents')
    .insert({
      deal_id: dealId,
      folder_id: null,
      name,
      display_name: name,
      file_type: fileType,
      file_size: fileSize !== null && fileSize !== undefined ? String(fileSize) : null,
      storage_path: storagePath,
      uploaded_by: uploadedBy ?? null,
      source_kind: sourceKind,
      source_ref: sourceKind === 'deal_om_address' ? (sourceRef ?? null) : null,
      indexing_status: 'pending',
    })
    .select('id')
    .single();

  if (error || !inserted?.id) {
    console.error('[rag] promoteDealDocAction insert failed', { dealId, sourceKind, error });
    return;
  }

  await enqueueIngest(inserted.id as string, dealId);
}

interface RemoveArgs {
  dealId: string;
  sourceKind: DealDocSourceKind;
  sourceRef?: string | null;
}

// Drop the terminal_dd_documents row for a deal-level slot (admin cleared
// the OM/PSA/etc.). Chunks cascade via FK.
export async function removeDealDocAction(args: RemoveArgs): Promise<void> {
  const { dealId, sourceKind, sourceRef } = args;
  if (!dealId || !sourceKind) return;

  const admin = createAdminClient();
  let q = admin
    .from('terminal_dd_documents')
    .delete()
    .eq('deal_id', dealId)
    .eq('source_kind', sourceKind);
  if (sourceKind === 'deal_om_address' && sourceRef) {
    q = q.eq('source_ref', sourceRef);
  }
  const { error } = await q;
  if (error) console.error('[rag] removeDealDocAction failed', { dealId, sourceKind, error });
}
