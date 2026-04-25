import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

// Shared logic for AI tenant extraction. Used by:
//   - /api/admin/deals/[id]/extract-tenants            (extracts from the deal's stored OM PDF)
//   - /api/admin/deals/[id]/extract-tenants-from-upload (extracts from an admin-uploaded PDF/CSV/Excel)

export interface ExtractedTenant {
  tenant_name: string | null;
  suite_unit: string | null;
  leased_sf: number | null;
  annual_base_rent: number | null;
  rent_per_sf: number | null;
  lease_type: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  option_renewals: string | null;
  escalation_structure: string | null;
  is_anchor: boolean | null;
  is_vacant: boolean | null;
  tenant_industry: string | null;
  guarantor: string | null;
  tenant_credit_rating: string | null;
  market_rent_estimate: number | null;
}

const LEASE_TYPE_VALUES = new Set(['NNN', 'NN', 'Modified Gross', 'Gross', 'Ground']);
const CREDIT_RATING_VALUES = new Set(['Investment Grade', 'National Credit', 'Regional', 'Local', 'Unknown']);

export function normalizeTenant(raw: Record<string, unknown>): ExtractedTenant {
  const get = (k: string) => (raw[k] === undefined ? null : raw[k]);
  const asString = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : v === null || v === undefined ? null : String(v);
  const asNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const asBool = (v: unknown): boolean | null => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const t = v.toLowerCase().trim();
      if (t === 'true' || t === 'yes') return true;
      if (t === 'false' || t === 'no') return false;
    }
    return null;
  };

  const leaseType = asString(get('lease_type'));
  const credit = asString(get('tenant_credit_rating'));

  return {
    tenant_name: asString(get('tenant_name')),
    suite_unit: asString(get('suite_unit')),
    leased_sf: asNumber(get('leased_sf')),
    annual_base_rent: asNumber(get('annual_base_rent')),
    rent_per_sf: asNumber(get('rent_per_sf')),
    lease_type: leaseType && LEASE_TYPE_VALUES.has(leaseType) ? leaseType : null,
    lease_start_date: asString(get('lease_start_date')),
    lease_end_date: asString(get('lease_end_date')),
    option_renewals: asString(get('option_renewals')),
    escalation_structure: asString(get('escalation_structure')),
    is_anchor: asBool(get('is_anchor')),
    is_vacant: asBool(get('is_vacant')),
    tenant_industry: asString(get('tenant_industry')),
    guarantor: asString(get('guarantor')),
    tenant_credit_rating: credit && CREDIT_RATING_VALUES.has(credit) ? credit : null,
    market_rent_estimate: asNumber(get('market_rent_estimate')),
  };
}

function buildExtractionPromptText(opts: { buildingLabel: string | null; sourceLabel: string }) {
  const buildingContext = opts.buildingLabel
    ? `\n\nIMPORTANT: This deal is a PORTFOLIO. Only extract tenants that belong to the building labeled "${opts.buildingLabel}". Ignore tenants that are explicitly part of other buildings. If the document describes only one building and it matches, extract its full roster.`
    : '';

  return `You are a commercial real estate underwriter. Extract the COMPLETE tenant roster from the attached ${opts.sourceLabel}.${buildingContext}

For each tenant, return:
- tenant_name
- suite_unit (if available)
- leased_sf (plain number, no commas)
- annual_base_rent (plain number, no $ or commas)
- rent_per_sf (plain number)
- lease_type (one of: NNN, NN, Modified Gross, Gross, Ground)
- lease_start_date (e.g. "01/2020" or "2020-01-01")
- lease_end_date (e.g. "12/2031")
- option_renewals (e.g. "2x5yr")
- escalation_structure (e.g. "2% annual", "CPI", "10% at year 5")
- is_anchor (true if described as anchor tenant)
- tenant_industry (e.g. "Grocery", "Dollar Store", "Medical", "Restaurant")
- guarantor (Corporate, Personal, or None)
- tenant_credit_rating (one of: Investment Grade, National Credit, Regional, Local, Unknown)

Also identify VACANT SPACES as objects with is_vacant=true, leased_sf, and optionally market_rent_estimate.

If a field cannot be determined, set it to null. Do NOT guess.

Return ONLY valid JSON in this shape:
{
  "tenants": [
    {
      "tenant_name": "...",
      "suite_unit": null,
      "leased_sf": 25000,
      "annual_base_rent": 162500,
      "rent_per_sf": 6.50,
      "lease_type": "NNN",
      "lease_start_date": null,
      "lease_end_date": "12/2031",
      "option_renewals": "2x5yr",
      "escalation_structure": "2% annual",
      "is_anchor": true,
      "is_vacant": false,
      "tenant_industry": "Grocery",
      "guarantor": "Corporate",
      "tenant_credit_rating": "Regional",
      "market_rent_estimate": null
    }
  ]
}

If the document does not contain a rent roll, return {"tenants": []}.

JSON only:`;
}

export type AiSource =
  | { kind: 'pdf'; name: string; bytes: Buffer }
  | { kind: 'text'; name: string; text: string };

export async function extractTenantsWithClaude(args: {
  apiKey: string;
  source: AiSource;
  buildingLabel: string | null;
}): Promise<{ tenants: ExtractedTenant[] }> {
  const anthropic = new Anthropic({ apiKey: args.apiKey });
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

  if (args.source.kind === 'pdf') {
    contentBlocks.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf' as const,
        data: args.source.bytes.toString('base64'),
      },
    });
  } else {
    contentBlocks.push({
      type: 'text',
      text: `[Attached document "${args.source.name}" — contents below]\n\n${args.source.text}`,
    });
  }

  const sourceLabel =
    args.source.kind === 'pdf' ? 'document (PDF)' : 'document (tabular text — CSV/spreadsheet export)';

  contentBlocks.push({
    type: 'text',
    text: buildExtractionPromptText({ buildingLabel: args.buildingLabel, sourceLabel }),
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 20000,
    messages: [{ role: 'user', content: contentBlocks }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse extraction output');
  }
  const parsed = JSON.parse(jsonMatch[0]) as { tenants?: Record<string, unknown>[] };
  return {
    tenants: Array.isArray(parsed.tenants) ? parsed.tenants.map(normalizeTenant) : [],
  };
}

// Inserts the extracted rows into tenant_leases with ai_extracted=true,
// preserving any existing rows by appending after the current max sort_order.
// Returns the count actually inserted.
export async function insertExtractedTenants(args: {
  admin: SupabaseClient;
  dealId: string;
  addressId: string | null;
  tenants: ExtractedTenant[];
}): Promise<{ inserted: number; error?: string }> {
  const { admin, dealId, addressId, tenants } = args;

  const { data: existing } = await admin
    .from('tenant_leases')
    .select('sort_order')
    .eq('deal_id', dealId);
  const maxOrder = existing && existing.length > 0
    ? Math.max(...existing.map((r) => (r.sort_order as number) ?? 0))
    : -1;

  const rows = tenants
    .filter((t) => t.tenant_name || t.is_vacant)
    .map((t, idx) => ({
      deal_id: dealId,
      address_id: addressId,
      tenant_name: t.is_vacant ? 'Vacant' : t.tenant_name ?? 'Unknown',
      suite_unit: t.suite_unit,
      leased_sf: t.leased_sf,
      annual_base_rent: t.is_vacant ? null : t.annual_base_rent,
      rent_per_sf: t.is_vacant ? null : t.rent_per_sf,
      lease_type: t.is_vacant ? null : (t.lease_type ?? 'NNN'),
      lease_start_date: t.lease_start_date,
      lease_end_date: t.lease_end_date,
      option_renewals: t.option_renewals,
      escalation_structure: t.escalation_structure,
      is_anchor: !!t.is_anchor,
      is_vacant: !!t.is_vacant,
      tenant_industry: t.tenant_industry,
      guarantor: t.guarantor,
      tenant_credit_rating: t.tenant_credit_rating,
      market_rent_estimate: t.is_vacant ? t.market_rent_estimate : null,
      status: 'Active',
      sort_order: maxOrder + 1 + idx,
      ai_extracted: true,
    }));

  if (rows.length === 0) {
    return { inserted: 0 };
  }

  const { error } = await admin.from('tenant_leases').insert(rows);
  if (error) return { inserted: 0, error: error.message };
  return { inserted: rows.length };
}
