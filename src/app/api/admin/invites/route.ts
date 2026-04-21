import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/auth/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_ROLES = ['investor', 'employee'] as const;
type InviteRole = typeof ALLOWED_ROLES[number];

export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth();
  if (!authResult.ok) return authResult.response;

  const body = await request.json().catch(() => null);
  const emailRaw: unknown = body?.email;
  const roleRaw: unknown = body?.role;

  if (typeof emailRaw !== 'string' || !emailRaw.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }
  if (typeof roleRaw !== 'string' || !ALLOWED_ROLES.includes(roleRaw as InviteRole)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }

  const email = emailRaw.trim().toLowerCase();
  const role = roleRaw as InviteRole;

  const admin = createAdminClient();

  // Reject if an account already exists with this email
  const { data: existingUser } = await admin
    .from('terminal_users')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (existingUser) {
    return NextResponse.json(
      { error: 'An account with that email already exists on RePrime Terminal.' },
      { status: 409 },
    );
  }

  // Reject if an active (non-accepted, non-expired) invite already exists for this email.
  // Expired invites are ignored — admin can re-invite without manual cleanup.
  const nowIso = new Date().toISOString();
  const { data: existingInvite } = await admin
    .from('terminal_invite_tokens')
    .select('id')
    .ilike('email', email)
    .is('accepted_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();
  if (existingInvite) {
    return NextResponse.json(
      { error: 'An active invitation for this email already exists.' },
      { status: 409 },
    );
  }

  const { data: token, error: insertError } = await admin
    .from('terminal_invite_tokens')
    .insert({
      email,
      role,
      invited_by: authResult.user.userId,
    })
    .select('token, expires_at')
    .single();

  if (insertError || !token) {
    console.error('[admin/invites] insert failed:', insertError);
    return NextResponse.json(
      { error: 'Failed to create invitation.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    token: token.token,
    expires_at: token.expires_at,
  });
}
