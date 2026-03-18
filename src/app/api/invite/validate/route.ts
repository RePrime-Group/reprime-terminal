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

  return NextResponse.json({ valid: true, email: data.email, role: data.role });
}
