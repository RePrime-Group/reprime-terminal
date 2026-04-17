import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ valid: false, reason: 'not_found' });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('terminal_invite_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (!data) {
    return NextResponse.json({ valid: false, reason: 'not_found' });
  }

  if (data.accepted_at) {
    return NextResponse.json({ valid: false, reason: 'used' });
  }

  if (new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' });
  }

  // If this is a team-invite, attach the parent investor's display name so the
  // acceptance page can show "{ParentName} invited you to join their team."
  let parentName: string | null = null;
  if (data.parent_investor_id) {
    const { data: parent } = await supabase
      .from('terminal_users')
      .select('full_name, company_name')
      .eq('id', data.parent_investor_id)
      .single();
    if (parent) {
      parentName = parent.full_name ?? parent.company_name ?? null;
    }
  }

  return NextResponse.json({
    valid: true,
    email: data.email,
    role: data.role,
    parent_investor_id: data.parent_investor_id ?? null,
    parent_name: parentName,
  });
}
