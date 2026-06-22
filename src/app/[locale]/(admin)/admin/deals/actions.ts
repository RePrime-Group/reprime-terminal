'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { parseDealInputs, calculatePropertyMetrics } from '@/lib/utils/deal-calculator';
import { parseImport, IMPORT_STATUSES, type RowError } from '@/lib/deals/importSchema';
import type { DealCreateInput } from '@/lib/deals/types';
import type { DealStatus } from '@/lib/types/database';

const DEALS_PATH = '/[locale]/admin/deals';

export type CreateDealResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

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
  return { ok: true as const, supabase, userId: profile.id as string };
}

// ── Tenant roster normalization (ported from the single-deal create form) ────
const LEASE_TYPES_SET = new Set(['NNN', 'NN', 'Modified Gross', 'Gross', 'Ground']);
const CREDIT_SET = new Set(['Investment Grade', 'National Credit', 'Regional', 'Local', 'Unknown']);

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const toStr = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;
const toBool = (v: unknown): boolean => v === true || v === 'true' || v === 'yes';

/** Compute the derived metrics for a deal, matching the single-deal form. */
function computeMetrics(input: DealCreateInput) {
  const ci = parseDealInputs({
    purchase_price: input.purchase_price,
    noi: input.noi,
    ltv: input.ltv || '75',
    interest_rate: input.interest_rate || '6.00',
    amortization_years: input.amortization_years || '30',
    loan_fee_points: input.loan_fee_points || '1',
    seller_financing: input.seller_financing,
    mezz_percent: input.mezz_percent || '15',
    mezz_rate: input.mezz_rate || '5.00',
    mezz_term_months: input.mezz_term_months || '60',
    seller_credit: input.seller_credit || '0',
    assignment_fee: input.assignment_fee,
    acq_fee: input.acq_fee,
    asset_mgmt_fee: input.asset_mgmt_fee,
    gp_carry: input.gp_carry,
    pref_return: input.pref_return,
    hold_period_years: input.hold_period_years || '5',
    exit_cap_rate: input.exit_cap_rate,
  });
  return calculatePropertyMetrics(ci);
}

/**
 * Core deal-creation sequence shared by the single-deal form and the bulk
 * importer: insert deal (with computed metrics) → portfolio addresses →
 * tenant roster → activity log. Auth is the caller's responsibility.
 */
async function insertDeal(
  supabase: SupabaseClient,
  userId: string,
  input: DealCreateInput
): Promise<CreateDealResult> {
  // Minimal required-field guard (mirrors the form's validate()).
  if (!input.name?.trim()) return { ok: false, error: 'Name is required.' };
  if (!input.city?.trim()) return { ok: false, error: 'City is required.' };
  if (!input.state?.trim()) return { ok: false, error: 'State is required.' };
  if (!input.property_type) return { ok: false, error: 'Property type is required.' };
  if (!input.purchase_price?.trim()) return { ok: false, error: 'Purchase price is required.' };

  const isPortfolio = !!input.is_portfolio;
  const highlights = (input.investment_highlights ?? [])
    .map((h) => h.trim())
    .filter((h) => h !== '');

  const cm = computeMetrics(input);

  const yearBuilt =
    input.year_built === null || input.year_built === undefined || input.year_built === ''
      ? null
      : typeof input.year_built === 'string'
        ? Number.parseInt(input.year_built, 10) || null
        : input.year_built;

  const { data: newDeal, error } = await supabase
    .from('terminal_deals')
    .insert({
      name: input.name.trim(),
      property_type: input.property_type,
      is_portfolio: isPortfolio,
      address: !isPortfolio && input.address?.trim() ? input.address.trim() : null,
      city: input.city.trim(),
      state: input.state.trim(),
      square_footage: input.square_footage || null,
      units: input.units || null,
      class_type: input.class_type || null,
      year_built: yearBuilt,
      year_renovated: input.year_renovated?.trim() || null,
      occupancy: input.occupancy || null,
      purchase_price: input.purchase_price.trim(),
      noi: input.noi || null,
      cap_rate: cm.capRate > 0 ? cm.capRate.toFixed(2) : null,
      irr: cm.irr !== null ? cm.irr.toFixed(2) : null,
      coc: cm.cocReturn !== null ? cm.cocReturn.toFixed(2) : null,
      dscr: cm.lenderDSCR > 0 ? cm.lenderDSCR.toFixed(2) : null,
      equity_required: cm.netEquity > 0 ? String(Math.round(cm.netEquity)) : null,
      loan_estimate: cm.loanAmount > 0 ? String(Math.round(cm.loanAmount)) : null,
      seller_financing: !!input.seller_financing,
      note_sale: !!input.note_sale,
      special_terms: input.special_terms ?? null,
      assignment_fee: input.assignment_fee?.trim() || null,
      assignment_irr: input.assignment_irr || null,
      gplp_irr: input.gplp_irr || null,
      acq_fee: input.acq_fee?.trim() || null,
      asset_mgmt_fee: input.asset_mgmt_fee?.trim() || null,
      gp_carry: input.gp_carry?.trim() || null,
      loan_fee: input.loan_fee ?? null,
      dd_deadline: input.dd_deadline || null,
      close_deadline: input.close_deadline || null,
      extension_deadline: input.extension_deadline || null,
      timeline_note: input.timeline_note?.trim() || null,
      psa_draft_start: input.psa_draft_start || null,
      loi_signed_at: input.loi_signed_at || null,
      teaser_description: input.teaser_description || null,
      deposit_amount: input.deposit_amount || null,
      deposit_held_by: input.deposit_held_by || null,
      neighborhood: input.neighborhood || null,
      metro_population: input.metro_population || null,
      job_growth: input.job_growth || null,
      quarter_release: input.quarter_release || null,
      investment_highlights: highlights.length > 0 ? highlights : null,
      acquisition_thesis: input.acquisition_thesis || null,
      ltv: input.ltv || '75',
      interest_rate: input.interest_rate || '6.00',
      amortization_years: input.amortization_years || '30',
      loan_fee_points: input.loan_fee_points || '1',
      io_period_months: input.io_period_months || '0',
      mezz_percent: input.mezz_percent || '15',
      mezz_rate: input.mezz_rate || '5.00',
      mezz_term_months: input.mezz_term_months || '60',
      seller_credit: input.seller_credit || '0',
      pref_return: input.pref_return?.trim() || null,
      area_cap_rate: input.area_cap_rate?.trim() || null,
      asking_cap_rate: input.asking_cap_rate?.trim() || null,
      hold_period_years: input.hold_period_years || '5',
      exit_cap_rate: input.exit_cap_rate || null,
      debt_terms_quoted: input.debt_terms_quoted || false,
      status: input.status,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !newDeal) {
    return { ok: false, error: error?.message ?? 'Failed to create deal.' };
  }

  // Portfolio addresses first, so extracted tenants can map to a building UUID
  // by label. Single-property deals keep the street on terminal_deals.address.
  const labelToAddressId = new Map<string, string>();
  if (isPortfolio && (input.addresses?.length ?? 0) > 0) {
    const addressInserts = (input.addresses ?? [])
      .filter((a) => a.label.trim())
      .map((a, i) => ({
        deal_id: newDeal.id,
        label: a.label.trim(),
        address: a.address?.trim() || null,
        city: a.city?.trim() || null,
        state: a.state?.trim() || null,
        square_footage: a.square_footage?.trim() || null,
        units: a.units?.trim() || null,
        display_order: i,
      }));

    if (addressInserts.length > 0) {
      const { data: insertedAddresses } = await supabase
        .from('terminal_deal_addresses')
        .insert(addressInserts)
        .select('id, label');
      for (const row of insertedAddresses ?? []) {
        const label = (row as { label?: string }).label;
        const id = (row as { id?: string }).id;
        if (label && id) labelToAddressId.set(label.toLowerCase(), id);
      }
    }
  }

  // Tenant roster (ai_extracted=true — admin reviews). Same shaping as the form.
  const tenants = input.tenants ?? [];
  if (tenants.length > 0) {
    const resolveAddressId = (rawLabel: unknown): string | null => {
      if (!isPortfolio) return null;
      const label = toStr(rawLabel);
      if (!label) return null;
      return labelToAddressId.get(label.toLowerCase()) ?? null;
    };

    const tenantRows = tenants
      .filter((t) => toStr(t.tenant_name) || toBool(t.is_vacant))
      .map((t, idx) => {
        const vacant = toBool(t.is_vacant);
        const leaseType = toStr(t.lease_type);
        const credit = toStr(t.tenant_credit_rating);
        return {
          deal_id: newDeal.id,
          address_id: resolveAddressId(t.address_label),
          tenant_name: vacant ? 'Vacant' : (toStr(t.tenant_name) ?? 'Unknown'),
          suite_unit: toStr(t.suite_unit),
          leased_sf: (() => {
            const n = toNum(t.leased_sf);
            return n !== null ? Math.round(n) : null;
          })(),
          annual_base_rent: vacant ? null : toNum(t.annual_base_rent),
          rent_per_sf: vacant ? null : toNum(t.rent_per_sf),
          lease_type: vacant
            ? null
            : leaseType && LEASE_TYPES_SET.has(leaseType)
              ? leaseType
              : 'NNN',
          lease_start_date: toStr(t.lease_start_date),
          lease_end_date: toStr(t.lease_end_date),
          option_renewals: toStr(t.option_renewals),
          escalation_structure: toStr(t.escalation_structure),
          is_anchor: toBool(t.is_anchor),
          is_vacant: vacant,
          tenant_industry: toStr(t.tenant_industry),
          guarantor: toStr(t.guarantor),
          tenant_credit_rating: credit && CREDIT_SET.has(credit) ? credit : null,
          market_rent_estimate: vacant ? toNum(t.market_rent_estimate) : null,
          status: 'Active',
          sort_order: idx,
          ai_extracted: true,
        };
      });
    if (tenantRows.length > 0) {
      await supabase.from('tenant_leases').insert(tenantRows);
    }
  }

  if (input.status !== 'draft') {
    await supabase.from('terminal_activity_log').insert({
      user_id: userId,
      deal_id: newDeal.id,
      action: 'deal_created',
      metadata: { deal_name: input.name.trim(), status: input.status },
    });
  }

  return { ok: true, id: newDeal.id };
}

/** Create a single deal. Shared by the new-deal form. */
export async function createDeal(input: DealCreateInput): Promise<CreateDealResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const result = await insertDeal(staff.supabase, staff.userId, input);
  if (result.ok) revalidatePath(DEALS_PATH, 'page');
  return result;
}

// ── Bulk import ──────────────────────────────────────────────────────────────
// Server-action request bodies are capped (~4.5MB on Vercel). Deal metadata is
// small (~1–2KB each), so this comfortably covers well over a thousand deals.
const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

export interface ImportPreviewRow {
  index: number;
  name: string;
  city: string;
  state: string;
  property_type: string;
  purchase_price: string;
  is_portfolio: boolean;
  address_count: number;
  tenant_count: number;
  cap_rate: string | null;
  status: DealStatus;
}

export type PreviewBulkResult =
  | { ok: true; valid: ImportPreviewRow[]; errors: RowError[]; total: number }
  | { ok: false; error: string };

export interface CommitRowResult {
  index: number;
  name: string;
  ok: boolean;
  id?: string;
  error?: string;
}

export type CommitBulkResult =
  | { ok: true; results: CommitRowResult[]; created: number; failed: number }
  | { ok: false; error: string };

function guardSize(jsonText: string): string | null {
  if (jsonText.length > MAX_IMPORT_BYTES) {
    return 'File is too large for a single import. Split it into smaller batches.';
  }
  return null;
}

/** Validate the file and return a dry-run preview. Writes nothing. */
export async function previewBulkDeals(jsonText: string): Promise<PreviewBulkResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const sizeError = guardSize(jsonText);
  if (sizeError) return { ok: false, error: sizeError };

  let parsed;
  try {
    parsed = parseImport(jsonText);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not parse file.' };
  }

  const valid: ImportPreviewRow[] = parsed.rows.map((row, i) => {
    const cm = computeMetrics(row);
    return {
      index: i,
      name: row.name,
      city: row.city,
      state: row.state,
      property_type: row.property_type,
      purchase_price: row.purchase_price,
      is_portfolio: row.is_portfolio,
      address_count: row.addresses?.length ?? 0,
      tenant_count: row.tenants?.length ?? 0,
      cap_rate: cm.capRate > 0 ? cm.capRate.toFixed(2) : null,
      status: row.status,
    };
  });

  return { ok: true, valid, errors: parsed.errors, total: parsed.total };
}

/**
 * Re-validate and create every valid deal in the file. Invalid rows are skipped
 * (they were surfaced at preview). Each deal is created independently — one
 * failure does not roll back the others.
 */
export async function commitBulkDeals(jsonText: string): Promise<CommitBulkResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const sizeError = guardSize(jsonText);
  if (sizeError) return { ok: false, error: sizeError };

  let parsed;
  try {
    parsed = parseImport(jsonText);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not parse file.' };
  }

  if (parsed.rows.length === 0) {
    return { ok: false, error: 'No valid deals to import.' };
  }

  const results: CommitRowResult[] = [];
  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const res = await insertDeal(staff.supabase, staff.userId, row);
    results.push({
      index: i,
      name: row.name,
      ok: res.ok,
      id: res.ok ? res.id : undefined,
      error: res.ok ? undefined : res.error,
    });
  }

  const created = results.filter((r) => r.ok).length;
  const failed = results.length - created;
  if (created > 0) revalidatePath(DEALS_PATH, 'page');

  return { ok: true, results, created, failed };
}

// ── Bulk status change (deals list) ──────────────────────────────────────────
const uuid = z.string().uuid();

export async function bulkUpdateDealStatus(
  dealIds: string[],
  status: DealStatus
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const ids = z.array(uuid).min(1).safeParse(dealIds);
  if (!ids.success) return { ok: false, error: 'No valid deals selected.' };
  if (!IMPORT_STATUSES.includes(status as (typeof IMPORT_STATUSES)[number])) {
    return { ok: false, error: 'Invalid status.' };
  }

  const { error, count } = await staff.supabase
    .from('terminal_deals')
    .update({ status }, { count: 'exact' })
    .in('id', ids.data);

  if (error) return { ok: false, error: error.message };

  revalidatePath(DEALS_PATH, 'page');
  return { ok: true, count: count ?? ids.data.length };
}
