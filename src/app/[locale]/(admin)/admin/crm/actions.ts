'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sendCriteriaFormEmail } from '@/lib/email/send';
import type {
  CrmInvestorStatus,
  CrmContactMethod,
  CrmInvestingAs,
  CrmOwnershipPref,
  CrmAttachment,
  CrmDocument,
  TerminalCrmMandate,
} from '@/lib/types/database';
import type { MandateInput } from '@/components/admin/crm/mandate';
import {
  validateInvestorImportRows,
  type InvestorImportRow,
  type RowConflict,
  type RowError as ImportRowError,
} from '@/lib/crm/importSchema';
import { parseInvestorsXlsxBase64 } from '@/lib/crm/parseInvestorsXlsx';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const CRM_PATH = '/[locale]/admin/crm';

function revalidate(investorId?: string) {
  // The repo's reliable refresh path is router.refresh() on the client; these
  // calls bust the server cache as belt-and-suspenders.
  revalidatePath(CRM_PATH, 'page');
  if (investorId) revalidatePath(`${CRM_PATH}/[id]`, 'page');
}

/** Resolve the caller and confirm they are staff (owner/employee). */
async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Sign in required.' };

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || (profile.role !== 'owner' && profile.role !== 'employee')) {
    return { ok: false as const, error: 'Forbidden.' };
  }
  return { ok: true as const, supabase, userId: profile.id };
}

/**
 * Look up a terminal_users.id by email (case-insensitive). Used to link a
 * fresh CRM row to its existing auth user when the user already exists.
 * Returns null if no matching user.
 */
async function findAuthUserIdByEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string | null | undefined,
): Promise<string | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const { data } = await supabase
    .from('terminal_users')
    .select('id')
    .ilike('email', normalized)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Investor inputs ──────────────────────────────────────────────────────────
export interface CrmInvestorInput {
  first_name: string;
  last_name: string;
  company_name?: string | null;
  title?: string | null;
  photo_url?: string | null;

  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  linkedin_url?: string | null;
  preferred_contact_method?: CrmContactMethod | null;

  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;

  status?: CrmInvestorStatus;
  source?: string | null;
  referred_by?: string | null;
  entity_type?: string | null;
  is_accredited?: boolean;

  equity_ready?: number | null;
  equity_committed?: number | null;
  equity_timeline?: string | null;

  // Criteria-form identity (Group A)
  investing_as?: CrmInvestingAs | null;
  capital_ready?: string | null;
  ownership_pref?: CrmOwnershipPref | null;
  timeline_to_deploy?: string | null;
  consent_contact?: boolean;
  managed_by?: string | null;

  internal_notes?: string | null;
}

export async function createInvestor(input: CrmInvestorInput): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!input.first_name?.trim() || !input.last_name?.trim()) {
    return { ok: false, error: 'First and last name are required.' };
  }

  // If a terminal_users row already exists for this email, link it now so
  // the CRM card surfaces the 'active' lifecycle state immediately.
  const authUserId = await findAuthUserIdByEmail(staff.supabase, input.email);

  const { data, error } = await staff.supabase
    .from('terminal_crm_investors')
    .insert({
      ...input,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email: input.email?.trim().toLowerCase() || null,
      auth_user_id: authUserId,
      created_by: staff.userId,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, id: data.id };
}

export async function updateInvestor(id: string, input: CrmInvestorInput): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  if (!id) return { ok: false, error: 'Investor id is required.' };

  // NOTE: deliberately does NOT touch total_deployed_with_reprime / deal_count —
  // those are owned solely by crm_add_message. Also does NOT touch
  // submission_token / criteria_submitted_at — those are owned by sendCriteriaForm
  // and the /api/criteria submit path respectively.
  //
  // auth_user_id IS recomputed on every update so it always reflects the
  // current email's match (link if the new email maps to a terminal_users row,
  // unlink otherwise).
  const authUserId = await findAuthUserIdByEmail(staff.supabase, input.email);

  const { error } = await staff.supabase
    .from('terminal_crm_investors')
    .update({
      ...input,
      first_name: input.first_name?.trim(),
      last_name: input.last_name?.trim(),
      email: input.email?.trim().toLowerCase() || null,
      auth_user_id: authUserId,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidate(id);
  return { ok: true, id };
}

export async function archiveInvestor(id: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  if (!id) return { ok: false, error: 'Investor id is required.' };

  const { error } = await staff.supabase
    .from('terminal_crm_investors')
    .update({ is_archived: true })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidate(id);
  return { ok: true, id };
}

// Hard delete with cascade + storage cleanup lives at
// /api/admin/crm/[id]/delete (owner-only, password re-auth required).
// Mirrors /api/admin/users/[id]/delete.

// ── Messages ─────────────────────────────────────────────────────────────────
export interface CrmMessageInput {
  investor_id: string;
  type: string;
  direction?: string | null;
  body?: string | null;
  posted_by: string;
  deal_reference?: string | null;
  amount_discussed?: number | null;
  commitment_amount?: number | null;
  attachments?: CrmAttachment[];
  follow_up_date?: string | null;
  follow_up_assigned_to?: string | null;
}

export async function addMessage(input: CrmMessageInput): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!input.investor_id) return { ok: false, error: 'Investor id is required.' };
  if (!input.body?.trim() && (!input.attachments || input.attachments.length === 0)) {
    return { ok: false, error: 'Add a message or an attachment.' };
  }
  if (!input.posted_by) return { ok: false, error: 'Posted by is required.' };

  // Atomic insert + last_contacted bump + commitment side-effect (see migration).
  const { data, error } = await staff.supabase.rpc('crm_add_message', {
    p_investor_id: input.investor_id,
    p_type: input.type || 'note',
    p_direction: input.direction ?? 'outbound',
    p_body: input.body ?? null,
    p_posted_by: input.posted_by,
    p_deal_reference: input.deal_reference ?? null,
    p_amount_discussed: input.amount_discussed ?? null,
    p_commitment_amount: input.commitment_amount ?? null,
    p_attachments: input.attachments ?? [],
    p_follow_up_date: input.follow_up_date ?? null,
    p_follow_up_assigned_to: input.follow_up_assigned_to ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidate(input.investor_id);
  return { ok: true, id: data as string };
}

export async function togglePin(
  messageId: string,
  investorId: string,
  pinned: boolean,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const { error } = await staff.supabase
    .from('terminal_crm_messages')
    .update({ is_pinned: pinned })
    .eq('id', messageId);

  if (error) return { ok: false, error: error.message };
  revalidate(investorId);
  return { ok: true, id: messageId };
}

export async function markFollowUpComplete(
  messageId: string,
  investorId: string,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const { error } = await staff.supabase
    .from('terminal_crm_messages')
    .update({ follow_up_completed: true, follow_up_completed_at: new Date().toISOString() })
    .eq('id', messageId);

  if (error) return { ok: false, error: error.message };
  revalidate(investorId);
  return { ok: true, id: messageId };
}

// ── Documents ────────────────────────────────────────────────────────────────
export async function uploadDocumentMetadata(
  investorId: string,
  doc: CrmDocument,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  // Read-modify-write the documents JSONB array.
  const { data: row, error: readErr } = await staff.supabase
    .from('terminal_crm_investors')
    .select('documents')
    .eq('id', investorId)
    .single();
  if (readErr) return { ok: false, error: readErr.message };

  const existing = (row?.documents as CrmDocument[] | null) ?? [];
  const { error } = await staff.supabase
    .from('terminal_crm_investors')
    .update({ documents: [...existing, doc] })
    .eq('id', investorId);

  if (error) return { ok: false, error: error.message };
  revalidate(investorId);
  return { ok: true, id: investorId };
}

// ── Mandates ─────────────────────────────────────────────────────────────────
/** Map a MandateInput onto the DB row shape. */
function mandateToRow(investorId: string, m: MandateInput) {
  return {
    investor_id: investorId,
    label: m.label?.trim() || null,
    color: null,
    is_active: true,
    property_types: m.property_types ?? [],
    listing_types: m.listing_types ?? [],
    states: m.states ?? [],
    property_class: m.property_class ?? [],
    structure_prefs: m.structure_prefs ?? [],
    min_price: m.min_price ?? null,
    max_price: m.max_price ?? null,
    min_cap: m.min_cap ?? null,
    min_coc: m.min_coc ?? null,
    min_occupancy: m.min_occupancy ?? null,
    max_occupancy: m.max_occupancy ?? null,
    min_sqft: m.min_sqft ?? null,
    max_sqft: m.max_sqft ?? null,
    price_per_sf_max: m.price_per_sf_max ?? null,
    min_lease_term_years: m.min_lease_term_years ?? null,
    strategy: m.strategy ?? null,
    tenant_credit_pref: m.tenant_credit_pref ?? null,
    notes: m.notes?.trim() || null,
  };
}

export async function createMandate(investorId: string, m: MandateInput): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  if (!investorId) return { ok: false, error: 'Investor id is required.' };

  const { data, error } = await staff.supabase
    .from('terminal_crm_mandates')
    .insert(mandateToRow(investorId, m))
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate(investorId);
  return { ok: true, id: data.id };
}

export async function updateMandate(
  mandateId: string,
  investorId: string,
  m: MandateInput,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  if (!mandateId || !investorId) return { ok: false, error: 'Ids are required.' };

  const row = mandateToRow(investorId, m);
  // Don't overwrite investor_id on update.
  const { investor_id: _ignored, ...patch } = row;
  void _ignored;
  const { error } = await staff.supabase
    .from('terminal_crm_mandates')
    .update(patch)
    .eq('id', mandateId)
    .eq('investor_id', investorId);

  if (error) return { ok: false, error: error.message };
  revalidate(investorId);
  return { ok: true, id: mandateId };
}

export async function deleteMandate(
  mandateId: string,
  investorId: string,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const { error } = await staff.supabase
    .from('terminal_crm_mandates')
    .delete()
    .eq('id', mandateId)
    .eq('investor_id', investorId);

  if (error) return { ok: false, error: error.message };
  revalidate(investorId);
  return { ok: true, id: mandateId };
}

export async function toggleMandateActive(
  mandateId: string,
  investorId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const { error } = await staff.supabase
    .from('terminal_crm_mandates')
    .update({ is_active: isActive })
    .eq('id', mandateId)
    .eq('investor_id', investorId);

  if (error) return { ok: false, error: error.message };
  revalidate(investorId);
  return { ok: true, id: mandateId };
}

// ── Send Criteria Form ───────────────────────────────────────────────────────
/**
 * Mint a fresh submission_token (overwriting any prior outstanding one),
 * send the email, write the audit row, and update form_last_sent_at.
 * On Resend failure, rolls the token back to NULL so the row state stays
 * consistent ("no outstanding token after a failed send").
 */
export async function sendCriteriaForm(investorId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  // Atomically swap to a fresh token and grab the identity in one round-trip.
  const { data: row, error: updErr } = await staff.supabase
    .from('terminal_crm_investors')
    .update({
      submission_token: crypto.randomUUID(),
      submission_token_issued_at: new Date().toISOString(),
    })
    .eq('id', investorId)
    .select('id, email, first_name, last_name, submission_token')
    .single();

  if (updErr || !row) {
    return { ok: false, error: updErr?.message || 'Investor not found.' };
  }
  if (!row.email) {
    // Roll back so the row doesn't look "invited" with no email.
    await staff.supabase
      .from('terminal_crm_investors')
      .update({ submission_token: null, submission_token_issued_at: null })
      .eq('id', investorId);
    return { ok: false, error: 'Investor has no email on file.' };
  }

  try {
    const result = await sendCriteriaFormEmail(
      row.email,
      `${row.first_name} ${row.last_name}`,
      row.submission_token!,
      'en',
    );

    await staff.supabase.from('terminal_crm_form_sends').insert({
      investor_id: investorId,
      submission_token: row.submission_token!,
      sent_by: staff.userId,
      resend_message_id: result.data?.id ?? null,
      subject: "RePrime: tell us what you're buying",
      delivery_status: 'sent',
    });
    await staff.supabase
      .from('terminal_crm_investors')
      .update({ form_last_sent_at: new Date().toISOString() })
      .eq('id', investorId);

    revalidate(investorId);
    return { ok: true, id: investorId };
  } catch (err) {
    // Roll back token on send failure.
    await staff.supabase
      .from('terminal_crm_investors')
      .update({ submission_token: null, submission_token_issued_at: null })
      .eq('id', investorId);

    await staff.supabase.from('terminal_crm_form_sends').insert({
      investor_id: investorId,
      submission_token: row.submission_token!,
      sent_by: staff.userId,
      subject: "RePrime: tell us what you're buying",
      delivery_status: 'failed',
    });

    revalidate(investorId);
    const msg = err instanceof Error ? err.message : 'Email send failed.';
    return { ok: false, error: msg };
  }
}

export interface BulkSendResult {
  sent: { investorId: string; email: string }[];
  failed: { investorId: string; email: string; error: string }[];
}

/** Bulk send — batched 10/200ms to stay well under Resend's 10/s. */
export async function sendCriteriaFormBulk(
  investorIds: string[],
): Promise<{ ok: true; result: BulkSendResult } | { ok: false; error: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  if (!investorIds?.length) return { ok: false, error: 'No investors selected.' };

  const sent: BulkSendResult['sent'] = [];
  const failed: BulkSendResult['failed'] = [];
  const BATCH = 10;
  const DELAY_MS = 200;

  for (let i = 0; i < investorIds.length; i += BATCH) {
    const slice = investorIds.slice(i, i + BATCH);
    const results = await Promise.all(slice.map((id) => sendCriteriaForm(id).then((r) => ({ id, r }))));
    for (const { id, r } of results) {
      if (r.ok) sent.push({ investorId: id, email: '' });
      else failed.push({ investorId: id, email: '', error: r.error });
    }
    if (i + BATCH < investorIds.length) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  revalidate();
  return { ok: true, result: { sent, failed } };
}

// ── Bulk XLSX import ─────────────────────────────────────────────────────────
export type ConflictAction = 'skip' | 'update';

export interface BulkPreviewResult {
  ok: true;
  valid: InvestorImportRow[];
  errors: ImportRowError[];
  conflicts: RowConflict[];
  total: number;
}

export interface BulkCommitRowResult {
  index: number;
  email: string;
  ok: boolean;
  action: 'inserted' | 'updated' | 'skipped' | 'failed';
  id?: string;
  error?: string;
}

export type BulkCommitResult =
  | {
      ok: true;
      results: BulkCommitRowResult[];
      created: number;
      updated: number;
      skipped: number;
      failed: number;
    }
  | { ok: false; error: string };

/** Returns parsed rows + per-row validation errors + email conflicts. */
export async function previewBulkInvestors(
  xlsxBase64: string,
): Promise<BulkPreviewResult | { ok: false; error: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  let parsedRows;
  try {
    parsedRows = parseInvestorsXlsxBase64(xlsxBase64);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not parse XLSX file.' };
  }

  const { valid, errors } = validateInvestorImportRows(parsedRows);

  // Lookup conflicts by lower(email).
  const emails = valid.map((r) => r.email.toLowerCase());
  const conflicts: RowConflict[] = [];
  if (emails.length > 0) {
    const { data: existing } = await staff.supabase
      .from('terminal_crm_investors')
      .select('id, email, first_name, last_name')
      .in('email', emails);
    const existingMap = new Map(
      (existing ?? []).map((r) => [r.email.toLowerCase(), r]),
    );
    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      const match = existingMap.get(row.email.toLowerCase());
      if (match) {
        conflicts.push({
          index: row.index,
          email: row.email,
          existingId: match.id,
          existingName: `${match.first_name} ${match.last_name}`,
        });
      }
    }
  }

  return { ok: true, valid, errors, conflicts, total: parsedRows.length };
}

export async function commitBulkInvestors(
  xlsxBase64: string,
  conflictResolutions: Record<number, ConflictAction>,
): Promise<BulkCommitResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  let parsedRows;
  try {
    parsedRows = parseInvestorsXlsxBase64(xlsxBase64);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not parse XLSX file.' };
  }
  const { valid } = validateInvestorImportRows(parsedRows);
  if (valid.length === 0) return { ok: false, error: 'No valid rows to import.' };

  // Fresh conflict lookup at commit time (defensive against TOCTOU).
  const emails = valid.map((r) => r.email.toLowerCase());
  const { data: existingRows } = await staff.supabase
    .from('terminal_crm_investors')
    .select('id, email')
    .in('email', emails);
  const existingByEmail = new Map((existingRows ?? []).map((r) => [r.email.toLowerCase(), r.id as string]));

  // Batched terminal_users lookup so we can link auth_user_id on each row
  // without N+1 queries during the import.
  const { data: matchedUsers } = await staff.supabase
    .from('terminal_users')
    .select('id, email')
    .in('email', emails);
  const authUserIdByEmail = new Map(
    (matchedUsers ?? []).map((u) => [u.email.toLowerCase(), u.id as string]),
  );

  const results: BulkCommitRowResult[] = [];
  let created = 0, updated = 0, skipped = 0, failed = 0;

  for (const row of valid) {
    const email = row.email.toLowerCase();
    const existingId = existingByEmail.get(email);
    const authUserId = authUserIdByEmail.get(email) ?? null;
    if (existingId) {
      const action = conflictResolutions[row.index];
      if (action === 'skip' || !action) {
        results.push({ index: row.index, email, ok: true, action: 'skipped' });
        skipped++;
        continue;
      }
      const { error } = await staff.supabase
        .from('terminal_crm_investors')
        .update({
          first_name: row.first_name,
          last_name: row.last_name,
          company_name: row.company_name ?? null,
          title: row.title ?? null,
          phone: row.phone ?? null,
          whatsapp: row.whatsapp ?? null,
          linkedin_url: row.linkedin_url ?? null,
          source: row.source ?? 'bulk_import',
          auth_user_id: authUserId,
        })
        .eq('id', existingId);
      if (error) {
        results.push({ index: row.index, email, ok: false, action: 'failed', error: error.message });
        failed++;
      } else {
        results.push({ index: row.index, email, ok: true, action: 'updated', id: existingId });
        updated++;
      }
    } else {
      const { data, error } = await staff.supabase
        .from('terminal_crm_investors')
        .insert({
          first_name: row.first_name,
          last_name: row.last_name,
          email,
          company_name: row.company_name ?? null,
          title: row.title ?? null,
          phone: row.phone ?? null,
          whatsapp: row.whatsapp ?? null,
          linkedin_url: row.linkedin_url ?? null,
          source: row.source ?? 'bulk_import',
          auth_user_id: authUserId,
          created_by: staff.userId,
        })
        .select('id')
        .single();
      if (error || !data) {
        results.push({ index: row.index, email, ok: false, action: 'failed', error: error?.message ?? 'Insert failed' });
        failed++;
      } else {
        results.push({ index: row.index, email, ok: true, action: 'inserted', id: data.id });
        created++;
      }
    }
  }

  if (created + updated > 0) revalidate();
  return { ok: true, results, created, updated, skipped, failed };
}

// ── Read helper used by profile page ─────────────────────────────────────────
export async function getMandatesForInvestor(investorId: string): Promise<TerminalCrmMandate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('terminal_crm_mandates')
    .select('*')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: true });
  return (data ?? []) as TerminalCrmMandate[];
}
