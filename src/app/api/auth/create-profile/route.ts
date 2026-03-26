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
    .select('email, role, accepted_at')
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

  // Create the terminal_users profile (bypasses RLS with service role)
  const { error: insertError } = await supabase
    .from('terminal_users')
    .insert({
      id: userId,
      email,
      full_name: fullName,
      role: invite.role,
      company_name: companyName || null,
    });

  if (insertError) {
    // If user already exists, just update
    if (insertError.message.includes('duplicate')) {
      await supabase.from('terminal_users').update({
        full_name: fullName,
        company_name: companyName || null,
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
