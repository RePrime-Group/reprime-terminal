import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTeamInviteEmail } from '@/lib/email/send';

export async function POST(
  request: NextRequest,
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

  const body = await request.json().catch(() => ({}));
  const locale: string = typeof body?.locale === 'string' ? body.locale : 'en';

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from('terminal_invite_tokens')
    .select('id, email, token, expires_at, parent_investor_id, accepted_at')
    .eq('id', id)
    .single();

  if (!invite || invite.parent_investor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (invite.accepted_at) {
    return NextResponse.json(
      { error: 'This invite has already been accepted.' },
      { status: 409 },
    );
  }

  const { data: me } = await admin
    .from('terminal_users')
    .select('full_name')
    .eq('id', user.id)
    .single();

  // Extend expiry by 30 more days on each resend
  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin
    .from('terminal_invite_tokens')
    .update({ expires_at: newExpiry })
    .eq('id', id);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reprimeterminal.com';
  const inviteUrl = `${baseUrl}/${locale}/invite/${invite.token}`;

  try {
    const { error } = await sendTeamInviteEmail(invite.email, {
      parentName: me?.full_name ?? 'A RePrime investor',
      inviteeName: invite.email,
      inviteUrl,
      inviteCode: invite.token,
      expiresAt: newExpiry,
    });
    if (error) {
      console.error('[team/invites resend] Resend error:', error);
      return NextResponse.json(
        { error: 'We couldn\u2019t resend the email. Please try again.' },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error('[team/invites resend] exception:', err);
    return NextResponse.json(
      { error: 'We couldn\u2019t resend the email. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, expires_at: newExpiry });
}
