'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type {
  CrmInvestorStatus,
  CrmContactMethod,
  CrmInvestmentPreferences,
  CrmAttachment,
  CrmDocument,
} from '@/lib/types/database';

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

  investment_preferences?: CrmInvestmentPreferences;
  internal_notes?: string | null;
}

export async function createInvestor(input: CrmInvestorInput): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!input.first_name?.trim() || !input.last_name?.trim()) {
    return { ok: false, error: 'First and last name are required.' };
  }

  const { data, error } = await staff.supabase
    .from('terminal_crm_investors')
    .insert({
      ...input,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      investment_preferences: input.investment_preferences ?? {},
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
  // those are owned solely by crm_add_message (see plan §8, double-count guard).
  const { error } = await staff.supabase
    .from('terminal_crm_investors')
    .update({
      ...input,
      first_name: input.first_name?.trim(),
      last_name: input.last_name?.trim(),
      investment_preferences: input.investment_preferences ?? {},
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
