import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getInvestorAuth, permissionDenied } from '@/lib/auth/requireInvestor';

// Logs a single "package_started" activity row when an investor kicks off a
// client-side ZIP build. The actual file fetches go through
// /api/documents/[id]/download?bulk=1, which suppresses per-file logs so the
// audit trail isn't drowned in N rows for one bundle.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await getInvestorAuth();
  if (!authResult.ok) return authResult.response;
  const denied = permissionDenied(authResult.user, 'download_documents');
  if (denied) return denied;

  let body: { type?: string; count?: number; doc_ids?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = body.type === 'selected_package' ? 'selected_package' : 'complete_package';
  const count = Number.isFinite(body.count) ? Number(body.count) : 0;
  const docIds = Array.isArray(body.doc_ids) ? body.doc_ids.slice(0, 1000) : [];

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

  await supabase.from('terminal_activity_log').insert({
    user_id: authResult.user.userId,
    deal_id: id,
    action: 'document_downloaded',
    metadata: { type, count, doc_ids: docIds, source: 'client_zip' },
  });

  return NextResponse.json({ ok: true });
}
