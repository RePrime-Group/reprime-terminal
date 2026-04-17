import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const body = await request.json().catch(() => ({}));
  const reactivate = body?.reactivate === true;

  const { data: target } = await admin
    .from('terminal_users')
    .select('id, parent_investor_id, is_active')
    .eq('id', userId)
    .single();

  if (!target || target.parent_investor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: updErr } = await admin
    .from('terminal_users')
    .update({ is_active: !reactivate ? false : true })
    .eq('id', userId);

  if (updErr) {
    console.error('[team/revoke] update failed:', updErr);
    return NextResponse.json(
      { error: 'We couldn\u2019t update access right now. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, is_active: reactivate });
}
