import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendCommitmentConfirmation, sendCommitmentWithdrawal } from '@/lib/email/send';
import { isValidE164 } from '@/lib/countries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { type, notes, phone } = await request.json();

  // Primary commitments require a validated phone number; persist it to the profile.
  if ((type || 'primary') === 'primary') {
    if (typeof phone !== 'string' || !isValidE164(phone)) {
      return NextResponse.json({ error: 'A valid phone number is required.' }, { status: 400 });
    }
    const { error: phoneErr } = await supabase
      .from('terminal_users')
      .update({ phone })
      .eq('id', user.id);
    if (phoneErr) {
      return NextResponse.json({ error: 'Could not save phone number.' }, { status: 500 });
    }
  }

  // Get deal info
  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('name, city, state, deposit_amount')
    .eq('id', id)
    .single();

  // Get investor info
  const { data: investor } = await supabase
    .from('terminal_users')
    .select('full_name, email, phone')
    .eq('id', user.id)
    .single();

  const { data: commitment, error } = await supabase
    .from('terminal_deal_commitments')
    .insert({
      deal_id: id,
      user_id: user.id,
      type: type || 'primary',
      deposit_amount: deal?.deposit_amount ?? null,
      status: 'pending',
      notes: notes || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('commitment insert failed:', error);
    // Unique constraint on (deal_id, user_id) — user already committed.
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json(
        { error: 'You\u2019ve already committed to this deal. Refresh the page to see your commitment.' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'We couldn\u2019t save your commitment. Please try again, or contact RePrime if this keeps happening.' },
      { status: 500 },
    );
  }

  // Log activity
  await supabase.from('terminal_activity_log').insert({
    user_id: user.id,
    deal_id: id,
    action: 'expressed_interest',
    metadata: { commitment_id: commitment?.id, type },
  });

  // Send confirmation emails
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reprimeterminal.com';
  const emailData = {
    investorName: investor?.full_name ?? 'Investor',
    investorEmail: investor?.email ?? undefined,
    investorPhone: investor?.phone ?? undefined,
    dealName: deal?.name ?? 'Deal',
    city: deal?.city ?? '',
    state: deal?.state ?? '',
    commitType: type || 'primary',
    depositAmount: deal?.deposit_amount ?? undefined,
    portalUrl: `${baseUrl}/en/portal/deals/${id}`,
  };

  try {
    if (investor?.email) {
      await sendCommitmentConfirmation(investor.email, emailData, ['shirel@reprime.com', 'g@reprime.com', 'steve@reprime.com']);
    }
  } catch (emailErr) {
    console.error('Commitment email failed:', emailErr);
  }

  return NextResponse.json({ success: true, commitmentId: commitment?.id });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { data } = await supabase
    .from('terminal_deal_commitments')
    .select('id, type, status, created_at')
    .eq('deal_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ commitment: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Withdrawal requires a validated phone number (same confirmation as commit).
  const body = await request.json().catch(() => ({}));
  const phone: unknown = body?.phone;
  if (typeof phone !== 'string' || !isValidE164(phone)) {
    return NextResponse.json({ error: 'A valid phone number is required.' }, { status: 400 });
  }
  const { error: phoneErr } = await supabase
    .from('terminal_users')
    .update({ phone })
    .eq('id', user.id);
  if (phoneErr) {
    return NextResponse.json({ error: 'Could not save phone number.' }, { status: 500 });
  }

  // Get deal + investor info before deleting
  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('name, city, state')
    .eq('id', id)
    .single();

  const { data: investor } = await supabase
    .from('terminal_users')
    .select('full_name, email, phone')
    .eq('id', user.id)
    .single();

  // Delete the commitment
  const { error } = await supabase
    .from('terminal_deal_commitments')
    .delete()
    .eq('deal_id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('commitment delete failed:', error);
    return NextResponse.json(
      { error: 'We couldn\u2019t process the withdrawal right now. Please try again, or contact RePrime if this keeps happening.' },
      { status: 500 },
    );
  }

  // Log activity
  await supabase.from('terminal_activity_log').insert({
    user_id: user.id,
    deal_id: id,
    action: 'commitment_withdrawn',
    metadata: {},
  });

  // Send withdrawal emails
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reprimeterminal.com';
  const emailData = {
    investorName: investor?.full_name ?? 'Investor',
    dealName: deal?.name ?? 'Deal',
    city: deal?.city ?? '',
    state: deal?.state ?? '',
    portalUrl: `${baseUrl}/en/portal/deals/${id}`,
  };

  try {
    if (investor?.email) {
      await sendCommitmentWithdrawal(investor.email, emailData, ['shirel@reprime.com', 'g@reprime.com', 'steve@reprime.com']);
    }
  } catch (emailErr) {
    console.error('Withdrawal email failed:', emailErr);
  }

  return NextResponse.json({ success: true });
}
