'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const DEALS_PATH = '/[locale]/admin/deals';

function revalidateDeal(dealId: string) {
  revalidatePath(`${DEALS_PATH}/[id]/insights`, 'page');
  revalidatePath(`${DEALS_PATH}/[id]`, 'page');
  void dealId;
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
 * Convert a human category name into the immutable snake_case backend slug.
 * "Pressure Point" -> "pressure_point", "  Motivation!! " -> "motivation".
 */
export async function toCategorySlug(displayName: string): Promise<string> {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') // non-alphanumerics -> underscore
    .replace(/^_+|_+$/g, '')     // trim leading/trailing underscores
    .replace(/_{2,}/g, '_');     // collapse runs
}

// ── Validation schemas ─────────────────────────────────────────────────────
const uuid = z.string().uuid('Invalid id.');
const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Category name is required.')
  .max(120, 'Category name is too long.');
const contentSchema = z
  .string()
  .trim()
  .min(1, 'Insight cannot be empty.')
  .max(5000, 'Insight is too long.');

// ── Categories (global taxonomy) ─────────────────────────────────────────────
/**
 * Create a global category, or return the existing one if its slug already
 * exists. The slug (`name`) is derived from the display name and is what we
 * dedupe on — two different display names that slugify to the same `name`
 * resolve to the same category.
 */
export async function createCategory(
  displayName: string,
): Promise<{ ok: true; id: string; existed: boolean } | { ok: false; error: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const parsed = displayNameSchema.safeParse(displayName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const slug = await toCategorySlug(parsed.data);
  if (!slug) return { ok: false, error: 'Category name must contain letters or numbers.' };

  // Dedupe against the existing slug before inserting.
  const { data: existing, error: lookupErr } = await staff.supabase
    .from('terminal_insight_categories')
    .select('id')
    .eq('name', slug)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };
  if (existing) return { ok: true, id: existing.id as string, existed: true };

  const { data, error } = await staff.supabase
    .from('terminal_insight_categories')
    .insert({ name: slug, display_name: parsed.data })
    .select('id')
    .single();

  // Race: another insert won the unique constraint between lookup and insert.
  if (error) {
    if (error.code === '23505') {
      const { data: raced } = await staff.supabase
        .from('terminal_insight_categories')
        .select('id')
        .eq('name', slug)
        .maybeSingle();
      if (raced) return { ok: true, id: raced.id as string, existed: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string, existed: false };
}

/** Rename a category's display label. The `name` slug is never touched. */
export async function renameCategory(
  categoryId: string,
  displayName: string,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(categoryId).success) return { ok: false, error: 'Invalid category id.' };
  const parsed = displayNameSchema.safeParse(displayName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await staff.supabase
    .from('terminal_insight_categories')
    .update({ display_name: parsed.data })
    .eq('id', categoryId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`${DEALS_PATH}/[id]/insights`, 'page');
  return { ok: true, id: categoryId };
}

// ── Insights (category × deal) ───────────────────────────────────────────────
export async function addInsight(input: {
  dealId: string;
  categoryId: string;
  content: string;
}): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(input.dealId).success) return { ok: false, error: 'Invalid deal id.' };
  if (!uuid.safeParse(input.categoryId).success) return { ok: false, error: 'Invalid category id.' };
  const parsed = contentSchema.safeParse(input.content);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { data, error } = await staff.supabase
    .from('terminal_deal_insights')
    .insert({ deal_id: input.dealId, category_id: input.categoryId, content: parsed.data })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateDeal(input.dealId);
  return { ok: true, id: data.id as string };
}

export async function updateInsight(
  insightId: string,
  content: string,
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  if (!uuid.safeParse(insightId).success) return { ok: false, error: 'Invalid insight id.' };
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { error } = await staff.supabase
    .from('terminal_deal_insights')
    .update({ content: parsed.data })
    .eq('id', insightId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`${DEALS_PATH}/[id]/insights`, 'page');
  revalidatePath(`${DEALS_PATH}/[id]`, 'page');
  return { ok: true, id: insightId };
}

export async function deleteInsight(insightId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  if (!uuid.safeParse(insightId).success) return { ok: false, error: 'Invalid insight id.' };

  const { error } = await staff.supabase
    .from('terminal_deal_insights')
    .delete()
    .eq('id', insightId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`${DEALS_PATH}/[id]/insights`, 'page');
  revalidatePath(`${DEALS_PATH}/[id]`, 'page');
  return { ok: true, id: insightId };
}
