import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getInvestorAuth, permissionDenied } from '@/lib/auth/requireInvestor';

type DocType = 'loi' | 'psa' | 'full-report' | 'costar-report' | 'tenants-report' | 'lease-summary';

const DOC_META: Record<DocType, { column: string; logAction: string; filenameSuffix: string; humanName: string }> = {
  'loi': { column: 'loi_signed_storage_path', logAction: 'loi_downloaded', filenameSuffix: 'Signed_LOI', humanName: 'Signed LOI' },
  'psa': { column: 'psa_storage_path', logAction: 'psa_downloaded', filenameSuffix: 'PSA', humanName: 'PSA' },
  'full-report': { column: 'full_report_storage_path', logAction: 'full_report_downloaded', filenameSuffix: 'Full_Report', humanName: 'Full Report' },
  'costar-report': { column: 'costar_report_storage_path', logAction: 'costar_report_downloaded', filenameSuffix: 'CoStar_Report', humanName: 'CoStar Report' },
  'tenants-report': { column: 'tenants_report_storage_path', logAction: 'tenants_report_downloaded', filenameSuffix: 'Tenant_Intelligence', humanName: 'Tenant Intelligence' },
  'lease-summary': { column: 'lease_summary_storage_path', logAction: 'lease_summary_downloaded', filenameSuffix: 'Lease_Summary', humanName: 'Lease Summary' },
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
    .select(`${meta.column}, name`)
    .eq('id', id)
    .single();

  const path = (deal as Record<string, unknown> | null)?.[meta.column] as string | undefined;
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
