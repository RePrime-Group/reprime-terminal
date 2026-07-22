import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getInvestorAuth, permissionDenied } from '@/lib/auth/requireInvestor';

type DocType = 'loi' | 'psa' | 'full-report' | 'costar-report' | 'tenants-report' | 'lease-summary';

// slotName is the terminal_dd_documents.name for this deal-level doc (the single
// source of truth); downloads resolve the storage path through that row.
const DOC_META: Record<DocType, { slotName: string; logAction: string; filenameSuffix: string; humanName: string }> = {
  'loi': { slotName: 'loi-signed', logAction: 'loi_downloaded', filenameSuffix: 'Signed_LOI', humanName: 'Signed LOI' },
  'psa': { slotName: 'purchase-sale-agreement', logAction: 'psa_downloaded', filenameSuffix: 'PSA', humanName: 'PSA' },
  'full-report': { slotName: 'full-report', logAction: 'full_report_downloaded', filenameSuffix: 'Full_Report', humanName: 'Full Report' },
  'costar-report': { slotName: 'costar-report', logAction: 'costar_report_downloaded', filenameSuffix: 'CoStar_Report', humanName: 'CoStar Report' },
  'tenants-report': { slotName: 'tenants-report', logAction: 'tenants_report_downloaded', filenameSuffix: 'Tenant_Intelligence', humanName: 'Tenant Intelligence' },
  'lease-summary': { slotName: 'lease-summary', logAction: 'lease_summary_downloaded', filenameSuffix: 'Lease_Summary', humanName: 'Lease Summary' },
};

function isDocType(v: string): v is DocType {
  return v === 'loi' || v === 'psa' || v === 'full-report' || v === 'costar-report' || v === 'tenants-report' || v === 'lease-summary';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  const { id, type } = await params;

  if (!isDocType(type)) {
    return NextResponse.json({ error: 'Unknown document type' }, { status: 400 });
  }

  const meta = DOC_META[type];
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    },
  );

  const authResult = await getInvestorAuth();
  if (!authResult.ok) return authResult.response;
  const denied = permissionDenied(authResult.user, 'download_documents');
  if (denied) return denied;
  const user = { id: authResult.user.userId };

  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('name')
    .eq('id', id)
    .single();

  const { data: doc } = await supabase
    .from('terminal_dd_documents')
    .select('storage_path')
    .eq('deal_id', id)
    .eq('name', meta.slotName)
    .maybeSingle();

  const path = doc?.storage_path ?? undefined;
  if (!deal || !path) {
    return NextResponse.json({ error: `${meta.humanName} not available` }, { status: 404 });
  }

  const { data: fileData, error } = await supabase.storage
    .from('terminal-dd-documents')
    .download(path);

  if (error || !fileData) {
    return NextResponse.json({ error: `Failed to download ${meta.humanName}` }, { status: 500 });
  }

  await supabase.from('terminal_activity_log').insert({
    user_id: user.id,
    deal_id: id,
    action: meta.logAction,
  });

  const safeName = ((deal as { name?: string }).name ?? 'deal').replace(/[^a-zA-Z0-9 ]/g, '');
  const filename = `${safeName}_${meta.filenameSuffix}.pdf`;
  const viewMode = _request.nextUrl.searchParams.get('view') === 'true';

  return new NextResponse(fileData, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': viewMode ? 'inline' : `attachment; filename="${filename}"`,
    },
  });
}
