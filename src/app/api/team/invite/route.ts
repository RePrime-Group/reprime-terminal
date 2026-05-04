import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTeamInviteEmail } from '@/lib/email/send';
import { DEFAULT_TEAM_PERMISSIONS, PERMISSION_KEYS, normalizePermissions } from '@/lib/auth/permissions';
import type { TeamPermissions, TeamPermissionKey } from '@/lib/types/database';

export async function POST(request: NextRequest) {
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

  // Parent must be an active investor who is NOT themselves a team-invited sub-user
  const { data: me } = await admin
    .from('terminal_users')
    .select('id, full_name, role, is_active, parent_investor_id, team_invite_limit')
    .eq('id', user.id)
    .single();

  if (!me || me.role !== 'investor' || !me.is_active) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (me.parent_investor_id) {
    return NextResponse.json(
      { error: 'Team members cannot invite additional team members.' },
      { status: 403 },
    );
  }

  const body = await request.json();
  const email: unknown = body?.email;
  const fullName: unknown = body?.full_name;
  const permissionsIn: unknown = body?.permissions;
  const locale: string = typeof body?.locale === 'string' ? body.locale : 'en';

  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }
  if (typeof fullName !== 'string' || fullName.trim().length < 2) {
    return NextResponse.json({ error: 'A team member name is required.' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Enforce invite cap: count active sub-users + pending invites
  const [{ count: activeCount }, { count: pendingCount }] = await Promise.all([
    admin
      .from('terminal_users')
      .select('id', { count: 'exact', head: true })
      .eq('parent_investor_id', user.id)
      .eq('is_active', true),
    admin
      .from('terminal_invite_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('parent_investor_id', user.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString()),
  ]);

  const used = (activeCount ?? 0) + (pendingCount ?? 0);
  if (used >= (me.team_invite_limit ?? 10)) {
    return NextResponse.json(
      { error: 'You\u2019ve used all of your team invites. Request more from the Team section.' },
      { status: 409 },
    );
  }

  // Prevent re-inviting an email that already belongs to an active account
  const { data: existingUser } = await admin
    .from('terminal_users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (existingUser) {
    return NextResponse.json(
      { error: 'An account with that email already exists on RePrime Terminal.' },
      { status: 409 },
    );
  }

  // Prevent duplicate pending invite to same email from same parent
  const { data: existingInvite } = await admin
    .from('terminal_invite_tokens')
    .select('id')
    .eq('email', normalizedEmail)
    .eq('parent_investor_id', user.id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (existingInvite) {
    return NextResponse.json(
      { error: 'You already have a pending invite for this email.' },
      { status: 409 },
    );
  }

  // Sanitize requested permissions — commit_withdraw may NEVER be enabled at invite
  // time; it always requires a separate admin-approval request after the user exists.
  const permissions = sanitizePermissionsAtInvite(permissionsIn);

  const { data: token, error: insertError } = await admin
    .from('terminal_invite_tokens')
    .insert({
      email: normalizedEmail,
      role: 'team_member',
      invited_by: user.id,
      parent_investor_id: user.id,
      permissions,
    })
    .select('id, token, expires_at')
    .single();

  if (insertError || !token) {
    console.error('[team/invite] insert failed:', insertError);
    return NextResponse.json(
      { error: 'We couldn\u2019t create the invite. Please try again, or contact RePrime if this keeps happening.' },
      { status: 500 },
    );
  }

  // Send invite email (best-effort — invite row is already created)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reprimeterminal.com';
  const inviteUrl = `${baseUrl}/${locale}/invite/${token.token}`;
  let emailSent = false;
  let emailError: string | null = null;
  try {
    const { error: emailErr } = await sendTeamInviteEmail(normalizedEmail, {
      parentName: me.full_name ?? 'A RePrime investor',
      inviteeName: fullName.trim(),
      inviteUrl,
      inviteCode: token.token,
      expiresAt: token.expires_at,
    });
    if (emailErr) {
      console.error('[team/invite] Resend error:', emailErr);
      emailError = emailErr.message ?? 'Email send failed';
    } else {
      emailSent = true;
    }
  } catch (err) {
    console.error('[team/invite] email exception:', err);
    emailError = err instanceof Error ? err.message : 'Email send failed';
  }

  return NextResponse.json({
    success: true,
    invite: {
      id: token.id,
      token: token.token,
      expires_at: token.expires_at,
      invite_url: inviteUrl,
    },
    email_sent: emailSent,
    email_error: emailError,
  });
}

function sanitizePermissionsAtInvite(raw: unknown): TeamPermissions {
  const cleaned = normalizePermissions(raw);
  const out: TeamPermissions = { ...DEFAULT_TEAM_PERMISSIONS };
  for (const key of PERMISSION_KEYS) {
    const k = key as TeamPermissionKey;
    // commit_withdraw can NEVER be enabled at invite time — it requires admin approval
    if (k === 'commit_withdraw') {
      out[k] = false;
      continue;
    }
    // view_deals is always on
    if (k === 'view_deals') {
      out[k] = true;
      continue;
    }
    if (k in cleaned) out[k] = cleaned[k] ?? false;
  }
  return out;
}
