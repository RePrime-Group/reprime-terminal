import { z } from 'zod';
import type { DealCreateInput } from './types';

/**
 * Validation + normalization for bulk JSON deal imports.
 *
 * The accepted shape is a hand-authorable superset of what the OM extractor
 * emits. Numbers may be given as JSON numbers or strings; booleans as booleans
 * or "true"/"yes". `is_portfolio` is DERIVED from the addresses array (>= 2
 * buildings => portfolio), matching the extractor's safety net — callers cannot
 * set it directly. Derived financial metrics are not accepted (computed server-side).
 */

export const PROPERTY_TYPES = [
  'Office',
  'Retail',
  'Industrial',
  'Multifamily',
  'Mixed-Use',
  'Hospitality',
  'Medical',
  'Other',
] as const;

export const IMPORT_STATUSES = [
  'draft',
  'coming_soon',
  'marketplace',
  'loi_signed',
  'published',
  'under_review',
  'assigned',
  'closed',
  'cancelled',
] as const;

// ── Field primitives ─────────────────────────────────────────────────────────
const optText = z.preprocess(
  (v) =>
    v === null || v === undefined || v === ''
      ? undefined
      : typeof v === 'number'
        ? String(v)
        : typeof v === 'string'
          ? v.trim()
          : v,
  z.string().optional()
);

const reqText = (label: string) =>
  z.preprocess(
    (v) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : v),
    z.string({ message: `${label} is required` }).min(1, `${label} is required`)
  );

const optBool = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', 'yes', '1'].includes(v.trim().toLowerCase());
  if (v === null || v === undefined) return undefined;
  return v;
}, z.boolean().optional());

const addressSchema = z.object({
  label: reqText('Address label'),
  address: optText,
  city: optText,
  state: optText,
  square_footage: optText,
  units: optText,
});

// Tenants are passed through loosely — createDeal() normalizes/clamps every
// field (lease type, credit rating, numeric coercion) before insert.
const tenantSchema = z.record(z.string(), z.unknown());

const dealSchema = z
  .object({
    name: reqText('name'),
    property_type: z.enum(PROPERTY_TYPES, {
      message: `property_type must be one of: ${PROPERTY_TYPES.join(', ')}`,
    }),
    address: optText,
    city: reqText('city'),
    state: reqText('state'),
    square_footage: optText,
    units: optText,
    class_type: z.enum(['A', 'B', 'C']).optional(),
    year_built: optText,
    year_renovated: optText,
    occupancy: optText,
    purchase_price: reqText('purchase_price'),
    noi: optText,
    seller_financing: optBool,
    note_sale: optBool,
    special_terms: optText,
    assignment_fee: optText,
    assignment_irr: optText,
    gplp_irr: optText,
    acq_fee: optText,
    asset_mgmt_fee: optText,
    gp_carry: optText,
    loan_fee: optText,
    ltv: optText,
    interest_rate: optText,
    amortization_years: optText,
    loan_fee_points: optText,
    io_period_months: optText,
    mezz_percent: optText,
    mezz_rate: optText,
    mezz_term_months: optText,
    seller_credit: optText,
    pref_return: optText,
    area_cap_rate: optText,
    asking_cap_rate: optText,
    hold_period_years: optText,
    exit_cap_rate: optText,
    debt_terms_quoted: optBool,
    dd_deadline: optText,
    close_deadline: optText,
    extension_deadline: optText,
    timeline_note: optText,
    psa_draft_start: optText,
    loi_signed_at: optText,
    teaser_description: optText,
    deposit_amount: optText,
    deposit_held_by: optText,
    neighborhood: optText,
    metro_population: optText,
    job_growth: optText,
    quarter_release: optText,
    investment_highlights: z.array(z.string().trim().min(1)).optional(),
    acquisition_thesis: optText,
    status: z.enum(IMPORT_STATUSES).optional(),
    addresses: z.array(addressSchema).optional(),
    tenants: z.array(tenantSchema).optional(),
  })
  // Unknown keys are rejected so typos in field names surface instead of being
  // silently dropped.
  .strict();

export type RawDealImport = z.infer<typeof dealSchema>;

export interface RowError {
  index: number;
  messages: string[];
}

export interface ParseImportResult {
  rows: DealCreateInput[];
  errors: RowError[];
  total: number;
}

/** Pull the deals array out of either a top-level array or `{ "deals": [...] }`. */
function extractArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { deals?: unknown }).deals)) {
    return (parsed as { deals: unknown[] }).deals;
  }
  return null;
}

function toCreateInput(raw: RawDealImport): DealCreateInput {
  const addresses = (raw.addresses ?? []).filter((a) => a.label.trim() !== '');
  // Derive portfolio status from address count, mirroring the extractor's rule:
  // 2+ buildings => portfolio (street lives per-address, top-level address null).
  const isPortfolio = addresses.length >= 2;

  return {
    ...raw,
    is_portfolio: isPortfolio,
    address: isPortfolio ? null : (raw.address ?? null),
    status: raw.status ?? 'draft',
    addresses: isPortfolio ? addresses : [],
  };
}

/**
 * Parse + validate a raw JSON string of deals.
 * Returns valid normalized rows AND per-row errors (1-based index in messages
 * is left to the caller). Throws only if the top-level JSON is unparseable or
 * not an array / { deals: [] }.
 */
export function parseImport(jsonText: string): ParseImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(
      `Invalid JSON: ${e instanceof Error ? e.message : 'could not parse file'}`
    );
  }

  const arr = extractArray(parsed);
  if (!arr) {
    throw new Error('Expected a JSON array of deals, or an object with a "deals" array.');
  }
  if (arr.length === 0) {
    throw new Error('No deals found in the file.');
  }

  const rows: DealCreateInput[] = [];
  const errors: RowError[] = [];

  arr.forEach((item, index) => {
    const result = dealSchema.safeParse(item);
    if (result.success) {
      rows.push(toCreateInput(result.data));
    } else {
      const messages = result.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      });
      errors.push({ index, messages });
    }
  });

  return { rows, errors, total: arr.length };
}
