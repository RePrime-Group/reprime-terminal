import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractTenantsWithClaude, insertExtractedTenants } from '@/lib/ai/extract-tenants';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only: extract tenant roster from a deal's uploaded OM into
// tenant_leases as AI-extracted drafts (ai_extracted=true). Admin must review.
//
// Sibling route /extract-tenants-from-upload accepts an admin-uploaded PDF/CSV
// /Excel for the same flow. Both routes share the AI call + insert logic in
// src/lib/ai/extract-tenants.ts.
// ─────────────────────────────────────────────────────────────────────────────

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
    } else if (deal.om_storage_path) {
      omPath = deal.om_storage_path as string;
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

  // Same 21MB cap as the upload route.
  const MAX_PDF_BYTES = 21 * 1024 * 1024;
  const { data: fileData, error: dlError } = await admin.storage
    .from('terminal-dd-documents')
    .download(omPath);
  if (dlError || !fileData) {
    return NextResponse.json(
      { error: `Failed to download OM: ${dlError?.message ?? 'unknown error'}` },
      { status: 500 },
    );
  }
  const buffer = Buffer.from(await fileData.arrayBuffer());
  if (buffer.byteLength > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `OM is ${(buffer.byteLength / 1024 / 1024).toFixed(0)}MB — too large to attach (max ${MAX_PDF_BYTES / 1024 / 1024}MB).` },
      { status: 400 },
    );
  }

  let extracted;
  try {
    extracted = await extractTenantsWithClaude({
      apiKey,
      source: { kind: 'pdf', name: 'OM.pdf', bytes: buffer },
      buildingLabel,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `AI extraction failed: ${message}` }, { status: 500 });
  }

  const { inserted, error: insertError } = await insertExtractedTenants({
    admin,
    dealId,
    addressId: targetAddressId,
    tenants: extracted.tenants,
  });
  if (insertError) {
    return NextResponse.json({ error: `Insert failed: ${insertError}` }, { status: 500 });
  }

  if (inserted === 0) {
    return NextResponse.json({ success: true, inserted: 0, message: 'No tenants identified in the document.' });
  }
  return NextResponse.json({ success: true, inserted });
}
