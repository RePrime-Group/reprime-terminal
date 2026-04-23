import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only: extract tenant roster from a deal's uploaded OM/LOI into
// tenant_leases as AI-extracted drafts (ai_extracted=true). Admin must review.
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedTenant {
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

function normalizeTenant(raw: Record<string, unknown>): ExtractedTenant {
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: dealId } = await context.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['owner', 'employee'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // Optional body: { addressId } — required for portfolio deals.
  const body = (await request.json().catch(() => null)) as { addressId?: string | null } | null;
  const requestedAddressId = body?.addressId ?? null;

  const admin = createAdminClient();

  // Tenant rosters live in the OM, not the LOI.
  const { data: deal } = await admin
    .from('terminal_deals')
    .select('id, is_portfolio, om_storage_path')
    .eq('id', dealId)
    .single();

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  // Resolve the OM + tagging target.
  //  - Single-property deal:  use terminal_deals.om_storage_path, address_id = NULL
  //  - Portfolio + addressId: use the address's om_storage_path, falling back to
  //                           the deal-level OM with the building's label as
  //                           context when the per-building OM is missing
  //  - Portfolio + no addressId: error — the admin must pick a building
  let omPath: string | null = null;
  let omName = 'OM.pdf';
  let buildingLabel: string | null = null;
  let targetAddressId: string | null = null;

  if (deal.is_portfolio) {
    if (!requestedAddressId) {
      return NextResponse.json(
        { error: 'This is a portfolio deal. Pass addressId in the request body to pick a building.' },
        { status: 400 },
      );
    }
    const { data: address } = await admin
      .from('terminal_deal_addresses')
      .select('id, label, om_storage_path')
      .eq('id', requestedAddressId)
      .eq('deal_id', dealId)
      .single();
    if (!address) {
      return NextResponse.json({ error: 'Address not found for this deal.' }, { status: 404 });
    }
    targetAddressId = address.id as string;
    buildingLabel = (address.label as string) ?? null;
    if (address.om_storage_path) {
      omPath = address.om_storage_path as string;
      omName = `${buildingLabel ?? 'Building'} OM.pdf`;
    } else if (deal.om_storage_path) {
      omPath = deal.om_storage_path as string;
      omName = 'Deal OM.pdf';
    }
  } else {
    if (deal.om_storage_path) {
      omPath = deal.om_storage_path as string;
    }
  }

  if (!omPath) {
    return NextResponse.json(
      { error: 'No OM available. Upload the OM on the deal (or on this building for a portfolio).' },
      { status: 400 },
    );
  }

  const storagePaths: { name: string; path: string }[] = [{ name: omName, path: omPath }];

  const anthropic = new Anthropic({ apiKey });
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

  const MAX_PDF_BYTES = 15 * 1024 * 1024;

  for (const sp of storagePaths) {
    const { data: fileData, error: dlError } = await admin.storage
      .from('terminal-dd-documents')
      .download(sp.path);
    if (dlError || !fileData) continue;
    const buffer = Buffer.from(await fileData.arrayBuffer());
    if (buffer.byteLength > MAX_PDF_BYTES) {
      contentBlocks.push({
        type: 'text',
        text: `[${sp.name} is ${(buffer.byteLength / 1024 / 1024).toFixed(0)}MB — too large to attach directly.]`,
      });
      continue;
    }
    contentBlocks.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf' as const,
        data: buffer.toString('base64'),
      },
    });
  }

  const buildingContext = buildingLabel
    ? `\n\nIMPORTANT: This deal is a PORTFOLIO. Only extract tenants that belong to the building labeled "${buildingLabel}". Ignore tenants that are explicitly part of other buildings. If the document describes only one building and it matches, extract its full roster.`
    : '';

  contentBlocks.push({
    type: 'text',
    text: `You are a commercial real estate underwriter. Extract the COMPLETE tenant roster from the attached offering memorandum (OM).${buildingContext}

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

JSON only:`,
  });

  let extracted: { tenants: ExtractedTenant[] } = { tenants: [] };
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 20000,
      messages: [{ role: 'user', content: contentBlocks }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse extraction output', raw: text }, { status: 500 });
    }
    const parsed = JSON.parse(jsonMatch[0]) as { tenants?: Record<string, unknown>[] };
    extracted = {
      tenants: Array.isArray(parsed.tenants) ? parsed.tenants.map(normalizeTenant) : [],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `AI extraction failed: ${message}` }, { status: 500 });
  }

  // Compute next sort_order based on existing rows (don't overwrite existing tenants)
  const { data: existing } = await admin
    .from('tenant_leases')
    .select('sort_order')
    .eq('deal_id', dealId);
  const maxOrder = existing && existing.length > 0
    ? Math.max(...existing.map((r) => (r.sort_order as number) ?? 0))
    : -1;

  const rows = extracted.tenants
    .filter((t) => t.tenant_name || t.is_vacant)
    .map((t, idx) => ({
      deal_id: dealId,
      address_id: targetAddressId,
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
    return NextResponse.json({ success: true, inserted: 0, message: 'No tenants identified in the document.' });
  }

  const { error: insertError } = await admin.from('tenant_leases').insert(rows);
  if (insertError) {
    return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, inserted: rows.length });
}
