import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Uses service role to bypass RLS — needed because new users aren't confirmed yet
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { userId, email, fullName, role, companyName, token } = await request.json();

  if (!userId || !email || !fullName || !role || !token) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify the invite token is valid
  const { data: invite } = await supabase
    .from('terminal_invite_tokens')
    .select('email, role, accepted_at, parent_investor_id, permissions, access_tier')
    .eq('token', token)
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite token' }, { status: 400 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
  }

  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: 'Email does not match invite' }, { status: 400 });
  }

  // Team-invited sub-users always get role='investor' so the portal layout's
  // role check passes. Their sub-user status is tracked via parent_investor_id.
  const isTeamInvite = invite.role === 'team_member' || !!invite.parent_investor_id;
  const resolvedRole = isTeamInvite ? 'investor' : invite.role;

  // access_tier: required (NOT NULL via CHECK) when role='investor', forbidden
  // for owner/employee.
  //  - Primary investor invites: tier is set on the invite token.
  //  - Team-invited sub-users: inherit tier from the parent investor so a
  //    marketplace-only parent's team also stays marketplace-only. If the
  //    parent lookup fails (parent deleted, etc.) fall back to 'investor'.
  let resolvedAccessTier: 'investor' | 'marketplace_only' | null = null;
  if (resolvedRole === 'investor') {
    if (isTeamInvite && invite.parent_investor_id) {
      const { data: parent } = await supabase
        .from('terminal_users')
        .select('access_tier')
        .eq('id', invite.parent_investor_id)
        .maybeSingle();
      const parentTier = parent?.access_tier as 'investor' | 'marketplace_only' | null | undefined;
      resolvedAccessTier = parentTier === 'marketplace_only' ? 'marketplace_only' : 'investor';
    } else {
      resolvedAccessTier = (invite.access_tier as 'investor' | 'marketplace_only' | null) ?? 'investor';
    }
  }

  // Create the terminal_users profile (bypasses RLS with service role)
  const { error: insertError } = await supabase
    .from('terminal_users')
    .insert({
      id: userId,
      email,
      full_name: fullName,
      role: resolvedRole,
      company_name: companyName || null,
      parent_investor_id: invite.parent_investor_id ?? null,
      permissions: invite.permissions ?? {},
      access_tier: resolvedAccessTier,
    });

  if (insertError) {
    // If user already exists, just update
    if (insertError.message.includes('duplicate')) {
      await supabase.from('terminal_users').update({
        full_name: fullName,
        company_name: companyName || null,
        ...(isTeamInvite
          ? {
              parent_investor_id: invite.parent_investor_id ?? null,
              permissions: invite.permissions ?? {},
            }
          : {}),
      }).eq('id', userId);
    } else {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // Mark invite as accepted
  await supabase
    .from('terminal_invite_tokens')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token);

  // Auto-confirm the user's email so they can log in immediately
  await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  return NextResponse.json({ success: true });
}
