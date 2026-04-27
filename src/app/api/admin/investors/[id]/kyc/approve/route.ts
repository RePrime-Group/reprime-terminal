import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: investorId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!me || (me.role !== 'owner' && me.role !== 'employee')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('terminal_user_kyc')
    .update({
      approved: true,
      approved_at: now,
      approved_by: user.id,
      rejected_at: null,
      rejection_reason: null,
      updated_at: now,
    })
    .eq('user_id', investorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
