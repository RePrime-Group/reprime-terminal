import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminAuth } from '@/lib/auth/requireAdmin';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await getAdminAuth();
  if (!authResult.ok) return authResult.response;

  const admin = createAdminClient();

  const { data: existing, error: fetchErr } = await admin
    .from('terminal_deal_commitments')
    .select('id, deal_id, user_id, status')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 });
  }
  if (existing.status === 'cancelled') {
    return NextResponse.json({ success: true, status: 'cancelled' });
  }

  const { error: updateErr } = await admin
    .from('terminal_deal_commitments')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (updateErr) {
    console.error('[admin/commitments/cancel] failed:', updateErr);
    return NextResponse.json({ error: 'Failed to cancel commitment.' }, { status: 500 });
  }

  await admin.from('terminal_activity_log').insert({
    user_id: existing.user_id,
    deal_id: existing.deal_id,
    action: 'commitment_withdrawn',
    metadata: {
      commitment_id: existing.id,
      cancelled_by_admin: true,
      admin_user_id: authResult.user.userId,
    },
  });

  return NextResponse.json({ success: true, status: 'cancelled' });
}
