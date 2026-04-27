import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface SetTierBody {
  access_tier?: 'investor' | 'marketplace_only';
}

export async function POST(
  request: NextRequest,
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

  const body = (await request.json().catch(() => ({}))) as SetTierBody;
  if (body.access_tier !== 'investor' && body.access_tier !== 'marketplace_only') {
    return NextResponse.json({ error: 'access_tier must be "investor" or "marketplace_only"' }, { status: 400 });
  }

  // The DB cross-column CHECK only allows access_tier on role='investor' rows;
  // confirm before updating to give a friendlier error than a constraint
  // violation.
  const { data: target } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', investorId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.role !== 'investor') {
    return NextResponse.json({ error: 'Tier only applies to investors.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('terminal_users')
    .update({ access_tier: body.access_tier, updated_at: new Date().toISOString() })
    .eq('id', investorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
