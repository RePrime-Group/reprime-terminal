import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTeamRequestAdminNotification } from '@/lib/email/send';

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

  const { data: me } = await admin
    .from('terminal_users')
    .select('id, full_name, email, role, parent_investor_id, is_active, team_invite_limit')
    .eq('id', user.id)
    .single();

  if (!me || me.role !== 'investor' || !me.is_active || me.parent_investor_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const requestedTotal = Number(body?.requested_total);
  const reason: string | null = typeof body?.reason === 'string' ? body.reason.slice(0, 1000) : null;

  if (!Number.isFinite(requestedTotal) || requestedTotal <= (me.team_invite_limit ?? 10) || requestedTotal > 200) {
    return NextResponse.json(
      { error: `Requested total must be greater than your current limit (${me.team_invite_limit ?? 10}).` },
      { status: 400 },
    );
  }

  const { data: inserted, error: insertErr } = await admin
    .from('terminal_team_requests')
    .insert({
      investor_id: user.id,
      request_type: 'invite_limit',
      requested_total: Math.round(requestedTotal),
      reason,
      status: 'pending',
    })
    .select('id, created_at')
    .single();

  if (insertErr || !inserted) {
    if (insertErr && /uniq_team_requests_pending_invite_limit|duplicate/i.test(insertErr.message ?? '')) {
      return NextResponse.json(
        { error: 'You already have a pending request to raise your invite limit.' },
        { status: 409 },
      );
    }
    console.error('[team/request-more] insert failed:', insertErr);
    return NextResponse.json(
      { error: 'We couldn\u2019t submit your request. Please try again.' },
      { status: 500 },
    );
  }

  // Notify admins
  try {
    await sendTeamRequestAdminNotification({
      requestType: 'invite_limit',
      investorName: me.full_name ?? 'Investor',
      investorEmail: me.email ?? '',
      requestedTotal: Math.round(requestedTotal),
      currentLimit: me.team_invite_limit ?? 10,
      reason,
    });
  } catch (err) {
    console.error('[team/request-more] admin email failed:', err);
  }

  return NextResponse.json({ success: true, request: inserted });
}
