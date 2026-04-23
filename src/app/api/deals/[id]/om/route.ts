import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getInvestorAuth, permissionDenied } from '@/lib/auth/requireInvestor';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  // Verify auth + document permission (team sub-users must have it enabled)
  const authResult = await getInvestorAuth();
  if (!authResult.ok) return authResult.response;
  const denied = permissionDenied(authResult.user, 'download_documents');
  if (denied) return denied;
  const user = { id: authResult.user.userId };

  const addressId = _request.nextUrl.searchParams.get('addressId');

  // Resolve the OM path: per-address when ?addressId= is provided, else the
  // deal-level OM. Scope the address lookup to this deal so callers can't
  // fetch another deal's OM by guessing an address id.
  let omStoragePath: string | null = null;
  let fileLabel: string | null = null;

  if (addressId) {
    const { data: addr } = await supabase
      .from('terminal_deal_addresses')
      .select('om_storage_path, label')
      .eq('id', addressId)
      .eq('deal_id', id)
      .single();
    omStoragePath = addr?.om_storage_path ?? null;
    fileLabel = addr?.label ?? null;
  }

  // Also need the deal name for the filename (and as fallback path source).
  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('om_storage_path, name')
    .eq('id', id)
    .single();

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  if (!addressId) {
    omStoragePath = deal.om_storage_path;
  }

  if (!omStoragePath) {
    return NextResponse.json({ error: 'OM not available' }, { status: 404 });
  }

  // Download from storage
  const { data: fileData, error } = await supabase.storage
    .from('terminal-dd-documents')
    .download(omStoragePath);

  if (error || !fileData) {
    return NextResponse.json({ error: 'Failed to download OM' }, { status: 500 });
  }

  // Log the download (include addressId in metadata when applicable)
  await supabase.from('terminal_activity_log').insert({
    user_id: user.id,
    deal_id: id,
    action: 'om_downloaded',
    metadata: addressId ? { address_id: addressId } : {},
  });

  const baseName = fileLabel ? `${deal.name} ${fileLabel}` : deal.name;
  const filename = `${baseName.replace(/[^a-zA-Z0-9 ]/g, '')}_OM.pdf`;
  const viewMode = _request.nextUrl.searchParams.get('view') === 'true';

  return new NextResponse(fileData, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': viewMode ? 'inline' : `attachment; filename="${filename}"`,
    },
  });
}
