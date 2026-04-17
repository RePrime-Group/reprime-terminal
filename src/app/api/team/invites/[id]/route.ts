import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from('terminal_invite_tokens')
    .select('id, parent_investor_id, accepted_at')
    .eq('id', id)
    .single();

  if (!invite || invite.parent_investor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (invite.accepted_at) {
    return NextResponse.json(
      { error: 'This invite has already been accepted and can\u2019t be cancelled.' },
      { status: 409 },
    );
  }

  const { error: delErr } = await admin
    .from('terminal_invite_tokens')
    .delete()
    .eq('id', id);

  if (delErr) {
    console.error('[team/invites DELETE] failed:', delErr);
    return NextResponse.json(
      { error: 'We couldn\u2019t cancel the invite. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
