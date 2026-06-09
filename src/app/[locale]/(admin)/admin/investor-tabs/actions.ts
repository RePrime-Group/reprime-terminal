'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const TABS_PATH = '/[locale]/admin/investor-tabs';
const DEALS_PATH = '/[locale]/admin/deals';

function revalidateTab(tabId?: string) {
  revalidatePath(TABS_PATH, 'page');
  if (tabId) revalidatePath(`${TABS_PATH}/[id]`, 'page');
}

function revalidateDeal(dealId?: string) {
  if (dealId) revalidatePath(`${DEALS_PATH}/[id]`, 'page');
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

// ── Validation schemas ─────────────────────────────────────────────────────
const uuid = z.string().uuid('Invalid id.');
const nameSchema = z.string().trim().min(1, 'Name is required.').max(120, 'Name is too long.');

const updateTabSchema = z.object({
  name: nameSchema.optional(),
  isEnabled: z.boolean().optional(),
  heroNote: z.string().trim().max(2000, 'Note is too long.').nullable().optional(),
});

const assignmentNoteSchema = z.object({
  matchReason: z.string().trim().max(500).optional(),
  internalNote: z.string().trim().max(2000).optional(),
});

// ── Groups ─────────────────────────────────────────────────────────────────
export async function createInvestorTab(name: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { data, error } = await staff.supabase
    .from('terminal_investor_tabs')
    .insert({ name: parsed.data, created_by: staff.userId })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateTab();
  return { ok: true, id: data.id };
}

export async function updateInvestorTab(
  tabId: string,
  input: { name?: string; isEnabled?: boolean; heroNote?: string | null },
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(tabId).success) return { ok: false, error: 'Invalid group id.' };
  const parsed = updateTabSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.isEnabled !== undefined) patch.is_enabled = parsed.data.isEnabled;
  if (parsed.data.heroNote !== undefined) patch.hero_note = parsed.data.heroNote;

  const { error } = await staff.supabase
    .from('terminal_investor_tabs')
    .update(patch)
    .eq('id', tabId);

  if (error) return { ok: false, error: error.message };
  revalidateTab(tabId);
  return { ok: true, id: tabId };
}

export async function deleteInvestorTab(tabId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  if (!uuid.safeParse(tabId).success) return { ok: false, error: 'Invalid group id.' };

  // Members + assignments cascade via FK ON DELETE CASCADE.
  const { error } = await staff.supabase
    .from('terminal_investor_tabs')
    .delete()
    .eq('id', tabId);

  if (error) return { ok: false, error: error.message };
  revalidateTab(tabId);
  return { ok: true, id: tabId };
}

// ── Membership ───────────────────────────────────────────────────────────────
export async function addTabMembers(tabId: string, userIds: string[]): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(tabId).success) return { ok: false, error: 'Invalid group id.' };
  const ids = z.array(uuid).safeParse(userIds);
  if (!ids.success) return { ok: false, error: 'Invalid user ids.' };
  if (ids.data.length === 0) return { ok: true, id: tabId };

  const rows = ids.data.map((user_id) => ({ tab_id: tabId, user_id, added_by: staff.userId }));
  const { error } = await staff.supabase
    .from('terminal_investor_tab_members')
    .upsert(rows, { onConflict: 'tab_id,user_id', ignoreDuplicates: true });

  if (error) return { ok: false, error: error.message };
  revalidateTab(tabId);
  return { ok: true, id: tabId };
}

export async function removeTabMember(tabId: string, userId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(tabId).success) return { ok: false, error: 'Invalid group id.' };
  if (!uuid.safeParse(userId).success) return { ok: false, error: 'Invalid user id.' };

  const { error } = await staff.supabase
    .from('terminal_investor_tab_members')
    .delete()
    .eq('tab_id', tabId)
    .eq('user_id', userId);

  if (error) return { ok: false, error: error.message };
  revalidateTab(tabId);
  return { ok: true, id: tabId };
}

// ── Deal ↔ group assignment ──────────────────────────────────────────────────
/**
 * Deal-side diff: set exactly which groups a deal belongs to.
 * Adds new assignments, removes dropped ones, updates notes on kept ones.
 * Never wipes-and-reinserts (preserves display_order / created_at).
 */
export async function setDealTabAssignments(
  dealId: string,
  tabIds: string[],
  notes?: Record<string, { matchReason?: string; internalNote?: string }>,
): Promise<{ ok: true; added: number; removed: number } | { ok: false; error: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(dealId).success) return { ok: false, error: 'Invalid deal id.' };
  const desiredIds = z.array(uuid).safeParse(tabIds);
  if (!desiredIds.success) return { ok: false, error: 'Invalid group ids.' };

  const desired = new Set(desiredIds.data);

  // Validate any provided notes.
  const notesByTab = notes ?? {};
  for (const [tabId, note] of Object.entries(notesByTab)) {
    if (!assignmentNoteSchema.safeParse(note).success) {
      return { ok: false, error: 'Invalid note for a group.' };
    }
    // Notes for groups not in the desired set are ignored on purpose.
    void tabId;
  }

  const { data: current, error: readErr } = await staff.supabase
    .from('terminal_deal_tab_assignments')
    .select('tab_id')
    .eq('deal_id', dealId);
  if (readErr) return { ok: false, error: readErr.message };

  const existing = new Set((current ?? []).map((r) => r.tab_id as string));

  const toAdd = [...desired].filter((t) => !existing.has(t));
  const toRemove = [...existing].filter((t) => !desired.has(t));
  const toUpdate = [...desired].filter((t) => existing.has(t));

  // Add new assignments (with notes if provided).
  if (toAdd.length > 0) {
    const rows = toAdd.map((tab_id) => ({
      deal_id: dealId,
      tab_id,
      assigned_by: staff.userId,
      match_reason: notesByTab[tab_id]?.matchReason ?? null,
      internal_note: notesByTab[tab_id]?.internalNote ?? null,
    }));
    const { error } = await staff.supabase.from('terminal_deal_tab_assignments').insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  // Remove dropped assignments.
  if (toRemove.length > 0) {
    const { error } = await staff.supabase
      .from('terminal_deal_tab_assignments')
      .delete()
      .eq('deal_id', dealId)
      .in('tab_id', toRemove);
    if (error) return { ok: false, error: error.message };
  }

  // Update notes on kept assignments (only when a note was supplied for it).
  for (const tab_id of toUpdate) {
    const note = notesByTab[tab_id];
    if (!note) continue;
    const { error } = await staff.supabase
      .from('terminal_deal_tab_assignments')
      .update({
        match_reason: note.matchReason ?? null,
        internal_note: note.internalNote ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('deal_id', dealId)
      .eq('tab_id', tab_id);
    if (error) return { ok: false, error: error.message };
  }

  revalidateDeal(dealId);
  revalidateTab();
  return { ok: true, added: toAdd.length, removed: toRemove.length };
}

export async function addDealsToTab(tabId: string, dealIds: string[]): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(tabId).success) return { ok: false, error: 'Invalid group id.' };
  const ids = z.array(uuid).safeParse(dealIds);
  if (!ids.success) return { ok: false, error: 'Invalid deal ids.' };
  if (ids.data.length === 0) return { ok: true, id: tabId };

  const rows = ids.data.map((deal_id) => ({ deal_id, tab_id: tabId, assigned_by: staff.userId }));
  const { error } = await staff.supabase
    .from('terminal_deal_tab_assignments')
    .upsert(rows, { onConflict: 'deal_id,tab_id', ignoreDuplicates: true });

  if (error) return { ok: false, error: error.message };
  revalidateTab(tabId);
  return { ok: true, id: tabId };
}

export async function removeDealFromTab(tabId: string, dealId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(tabId).success) return { ok: false, error: 'Invalid group id.' };
  if (!uuid.safeParse(dealId).success) return { ok: false, error: 'Invalid deal id.' };

  const { error } = await staff.supabase
    .from('terminal_deal_tab_assignments')
    .delete()
    .eq('tab_id', tabId)
    .eq('deal_id', dealId);

  if (error) return { ok: false, error: error.message };
  revalidateTab(tabId);
  return { ok: true, id: tabId };
}

export async function reorderTabDeals(
  tabId: string,
  orderedDealIds: string[],
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(tabId).success) return { ok: false, error: 'Invalid group id.' };
  const ids = z.array(uuid).safeParse(orderedDealIds);
  if (!ids.success) return { ok: false, error: 'Invalid deal ids.' };

  // Write the new position for each deal in this tab.
  for (let i = 0; i < ids.data.length; i++) {
    const { error } = await staff.supabase
      .from('terminal_deal_tab_assignments')
      .update({ display_order: i, updated_at: new Date().toISOString() })
      .eq('tab_id', tabId)
      .eq('deal_id', ids.data[i]);
    if (error) return { ok: false, error: error.message };
  }

  revalidateTab(tabId);
  return { ok: true, id: tabId };
}
