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

  // Resolve the OM from terminal_dd_documents (the single source of truth),
  // keyed by the slot `name`: 'offering-memorandum' for the deal-level OM,
  // 'offering-memorandum-<8-char-address-id-prefix>' for a per-address OM.
  let omStoragePath: string | null = null;
  let fileLabel: string | null = null;

  if (addressId) {
    // Scope the address lookup to this deal so callers can't fetch another
    // deal's OM by guessing an address id, and grab its label for the filename.
    const { data: addr } = await supabase
      .from('terminal_deal_addresses')
      .select('label')
      .eq('id', addressId)
      .eq('deal_id', id)
      .single();
    if (!addr) {
      return NextResponse.json({ error: 'OM not available' }, { status: 404 });
    }
    fileLabel = addr.label ?? null;
  }

  const slotName = addressId ? `offering-memorandum-${addressId.slice(0, 8)}` : 'offering-memorandum';

  // Also need the deal name for the filename.
  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('name')
    .eq('id', id)
    .single();

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  const { data: omDoc } = await supabase
    .from('terminal_dd_documents')
    .select('storage_path')
    .eq('deal_id', id)
    .eq('name', slotName)
    .maybeSingle();
  omStoragePath = omDoc?.storage_path ?? null;

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
