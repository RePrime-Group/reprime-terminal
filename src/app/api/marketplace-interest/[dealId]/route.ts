import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface InterestBody {
  interest_type?: 'at_asking' | 'custom_price';
  target_price?: number | string | null;
  notes?: string | null;
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Confirm the deal is actually marketplace status. We don't want investors
  // expressing interest on, say, a published deal via a stale or crafted URL.
  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('id, status')
    .eq('id', dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  if (deal.status !== 'marketplace') {
    return NextResponse.json({ error: 'Deal is not on the marketplace' }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as InterestBody;
  const interest_type = body.interest_type === 'custom_price' ? 'custom_price' : 'at_asking';

  let target_price: number | null = null;
  if (interest_type === 'custom_price') {
    const raw = body.target_price;
    const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '').replace(/[$,\s]/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'Target price must be a positive number.' }, { status: 400 });
    }
    target_price = parsed;
  }

  const notes = body.notes?.toString().trim() || null;

  const { error } = await supabase
    .from('marketplace_interest')
    .upsert(
      {
        deal_id: dealId,
        user_id: user.id,
        interest_type,
        target_price,
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'deal_id,user_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('marketplace_interest')
    .delete()
    .eq('deal_id', dealId)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
