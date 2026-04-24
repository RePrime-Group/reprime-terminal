import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendCommitmentConfirmation, sendCommitmentWithdrawal } from '@/lib/email/send';
import { isValidE164 } from '@/lib/countries';
import { getInvestorAuth, permissionDenied } from '@/lib/auth/requireInvestor';
import { createAdminClient } from '@/lib/supabase/admin';
import { getHouseholdUserIds } from '@/lib/auth/household';

const RP_ADMIN_CC = ['shirel@reprime.com', 'g@reprime.com', 'steve@reprime.com'];

function locationLine(deal: { city?: string | null; state?: string | null } | null | undefined): string {
  const city = deal?.city ?? '';
  const state = deal?.state ?? '';
  return `${city}${city && state ? ', ' : ''}${state}`.trim();
}

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

  const authResult = await getInvestorAuth();
  if (!authResult.ok) return authResult.response;
  const denied = permissionDenied(authResult.user, 'commit_withdraw');
  if (denied) return denied;
  const user = { id: authResult.user.userId };

  const { type, notes, phone, investment_structure, terms_snapshot } = await request.json();

  const ALLOWED_STRUCTURES = ['assignment', 'gplp'] as const;
  type InvestmentStructure = (typeof ALLOWED_STRUCTURES)[number];
  const structure: InvestmentStructure | null =
    typeof investment_structure === 'string' &&
    (ALLOWED_STRUCTURES as readonly string[]).includes(investment_structure)
      ? (investment_structure as InvestmentStructure)
      : null;
  const snapshot: Record<string, unknown> | null =
    terms_snapshot && typeof terms_snapshot === 'object' && !Array.isArray(terms_snapshot)
      ? (terms_snapshot as Record<string, unknown>)
      : null;

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

  const admin = createAdminClient();

  // Household-level duplicate check: one commitment per household per deal.
  const householdIds = await getHouseholdUserIds(user.id);
  const { data: existing } = await admin
    .from('terminal_deal_commitments')
    .select('id, user_id')
    .eq('deal_id', id)
    .in('user_id', householdIds)
    .limit(1);

  if (existing && existing.length > 0) {
    const existingCommit = existing[0];
    let committerName = 'Your team';
    if (existingCommit.user_id !== user.id) {
      const { data: committer } = await admin
        .from('terminal_users')
        .select('full_name')
        .eq('id', existingCommit.user_id)
        .single();
      committerName = committer?.full_name ?? 'a team member';
    } else {
      committerName = 'You';
    }
    const structureLabel =
      structure === 'assignment'
        ? ' under Assignment'
        : structure === 'gplp'
        ? ' under GP/LP Partnership'
        : '';
    return NextResponse.json(
      {
        error: `${committerName} already committed to this deal on behalf of your team${structureLabel ? `, and a new commitment${structureLabel} can’t be added alongside it` : ''}. Refresh to see it, or withdraw the existing commitment first.`,
      },
      { status: 409 },
    );
  }

  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('name, city, state, deposit_amount')
    .eq('id', id)
    .single();

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
      investment_structure: structure,
      terms_snapshot: snapshot,
    })
    .select('id')
    .single();

  if (error) {
    console.error('commitment insert failed:', error);
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

  await supabase.from('terminal_activity_log').insert({
    user_id: user.id,
    deal_id: id,
    action: 'expressed_interest',
    metadata: {
      commitment_id: commitment?.id,
      type,
      investment_structure: structure,
      terms_snapshot: snapshot,
    },
  });

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

  const cc = [...RP_ADMIN_CC];
  if (authResult.user.parentInvestorId) {
    const { data: parent } = await admin
      .from('terminal_users')
      .select('email, id')
      .eq('id', authResult.user.parentInvestorId)
      .single();
    if (parent?.email) cc.push(parent.email);
    if (parent?.id) {
      await admin.from('terminal_notifications').insert({
        user_id: parent.id,
        deal_id: id,
        type: 'team_commit',
        title: `${investor?.full_name ?? 'Your team member'} committed to ${deal?.name ?? 'a deal'}`,
        description: locationLine(deal),
      });
    }
  }

  try {
    if (investor?.email) {
      await sendCommitmentConfirmation(investor.email, emailData, cc);
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

  // Household-aware: return a commitment made by anyone in the caller's
  // household so all members see "✓ Committed" consistently.
  const admin = createAdminClient();
  const householdIds = await getHouseholdUserIds(user.id);

  const { data } = await admin
    .from('terminal_deal_commitments')
    .select('id, type, status, created_at, user_id')
    .eq('deal_id', id)
    .in('user_id', householdIds)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ commitment: null });
  }

  let committerName: string | null = null;
  if (data.user_id !== user.id) {
    const { data: committer } = await admin
      .from('terminal_users')
      .select('full_name')
      .eq('id', data.user_id)
      .single();
    committerName = committer?.full_name ?? null;
  }

  return NextResponse.json({
    commitment: {
      id: data.id,
      type: data.type,
      status: data.status,
      created_at: data.created_at,
      committer_user_id: data.user_id,
      committer_name: committerName,
      committed_by_self: data.user_id === user.id,
    },
  });
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

  const authResult = await getInvestorAuth();
  if (!authResult.ok) return authResult.response;
  const denied = permissionDenied(authResult.user, 'commit_withdraw');
  if (denied) return denied;
  const user = { id: authResult.user.userId };

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

  const admin = createAdminClient();

  // Find the household commitment — any household member with commit_withdraw
  // permission can withdraw any household-owned commitment.
  const householdIds = await getHouseholdUserIds(user.id);
  const { data: commitment } = await admin
    .from('terminal_deal_commitments')
    .select('id, user_id')
    .eq('deal_id', id)
    .in('user_id', householdIds)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!commitment) {
    return NextResponse.json(
      { error: 'No commitment found to withdraw.' },
      { status: 404 },
    );
  }

  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('name, city, state')
    .eq('id', id)
    .single();

  // The "actor" is whoever is clicking withdraw. The "committer" is whoever
  // originally committed (could be the same person, a household sibling, or
  // the parent). Withdrawal email goes to the committer; actor is CC'd when
  // different so everyone stays informed.
  const { data: actor } = await admin
    .from('terminal_users')
    .select('id, full_name, email, phone, parent_investor_id')
    .eq('id', user.id)
    .single();

  const { data: committer } = await admin
    .from('terminal_users')
    .select('id, full_name, email, phone, parent_investor_id')
    .eq('id', commitment.user_id)
    .single();

  const { error: delErr } = await admin
    .from('terminal_deal_commitments')
    .delete()
    .eq('id', commitment.id);

  if (delErr) {
    console.error('commitment delete failed:', delErr);
    return NextResponse.json(
      { error: 'We couldn\u2019t process the withdrawal right now. Please try again, or contact RePrime if this keeps happening.' },
      { status: 500 },
    );
  }

  await admin.from('terminal_activity_log').insert({
    user_id: user.id,
    deal_id: id,
    action: 'commitment_withdrawn',
    metadata: {
      commitment_id: commitment.id,
      original_committer_user_id: commitment.user_id,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reprimeterminal.com';
  const emailData = {
    investorName: committer?.full_name ?? 'Investor',
    dealName: deal?.name ?? 'Deal',
    city: deal?.city ?? '',
    state: deal?.state ?? '',
    portalUrl: `${baseUrl}/en/portal/deals/${id}`,
  };

  // Build CC list: admins + actor (if different from committer) + parent
  // investor of the household (if not already committer or actor).
  const cc = new Set<string>(RP_ADMIN_CC);
  if (actor?.email && actor.id !== committer?.id) cc.add(actor.email);

  const householdRootId =
    actor?.parent_investor_id ?? actor?.id ?? committer?.parent_investor_id ?? committer?.id ?? null;
  if (householdRootId && householdRootId !== committer?.id && householdRootId !== actor?.id) {
    const { data: parent } = await admin
      .from('terminal_users')
      .select('email, id')
      .eq('id', householdRootId)
      .single();
    if (parent?.email) cc.add(parent.email);
  }

  // In-app notifications: tell the household root (if sub-user acted) AND tell
  // the original committer (if someone else withdrew their commit).
  const notifyTargets = new Set<string>();
  if (householdRootId && householdRootId !== actor?.id) notifyTargets.add(householdRootId);
  if (committer?.id && committer.id !== actor?.id) notifyTargets.add(committer.id);

  for (const targetId of notifyTargets) {
    const isOriginalCommitter = targetId === committer?.id;
    await admin.from('terminal_notifications').insert({
      user_id: targetId,
      deal_id: id,
      type: isOriginalCommitter ? 'team_withdraw_of_yours' : 'team_withdraw',
      title: isOriginalCommitter
        ? `${actor?.full_name ?? 'A team member'} withdrew your commitment on ${deal?.name ?? 'a deal'}`
        : `${actor?.full_name ?? 'Your team member'} withdrew from ${deal?.name ?? 'a deal'}`,
      description: locationLine(deal),
    });
  }

  try {
    if (committer?.email) {
      await sendCommitmentWithdrawal(committer.email, emailData, [...cc]);
    }
  } catch (emailErr) {
    console.error('Withdrawal email failed:', emailErr);
  }

  return NextResponse.json({ success: true });
}
