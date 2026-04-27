import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface BulkTierBody {
  ids?: string[];
  access_tier?: 'investor' | 'marketplace_only';
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json().catch(() => ({}))) as BulkTierBody;
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'No investors selected.' }, { status: 400 });
  }
  if (body.access_tier !== 'investor' && body.access_tier !== 'marketplace_only') {
    return NextResponse.json({ error: 'access_tier must be "investor" or "marketplace_only"' }, { status: 400 });
  }

  // Only update rows that are actually investors — DB CHECK would reject
  // non-investor rows anyway, but filtering server-side avoids partial errors.
  const { error, count } = await supabase
    .from('terminal_users')
    .update({ access_tier: body.access_tier, updated_at: new Date().toISOString() }, { count: 'exact' })
    .in('id', body.ids)
    .eq('role', 'investor');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: count ?? 0 });
}
