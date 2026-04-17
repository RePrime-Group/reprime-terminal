import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { APPROVAL_REQUIRED_KEYS } from '@/lib/auth/permissions';
import { sendTeamRequestAdminNotification } from '@/lib/email/send';
import type { TeamPermissionKey } from '@/lib/types/database';

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

  const body = await request.json();
  const targetUserId: unknown = body?.target_user_id;
  const permissionKey: unknown = body?.permission_key;
  const reason: string | null = typeof body?.reason === 'string' ? body.reason.slice(0, 1000) : null;

  if (typeof targetUserId !== 'string' || typeof permissionKey !== 'string') {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }
  if (!APPROVAL_REQUIRED_KEYS.includes(permissionKey as TeamPermissionKey)) {
    return NextResponse.json(
      { error: 'This permission doesn\u2019t require admin approval.' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const [meRes, targetRes] = await Promise.all([
    admin
      .from('terminal_users')
      .select('id, full_name, email, role, parent_investor_id, is_active')
      .eq('id', user.id)
      .single(),
    admin
      .from('terminal_users')
      .select('id, full_name, email, parent_investor_id, is_active')
      .eq('id', targetUserId)
      .single(),
  ]);

  const me = meRes.data;
  const target = targetRes.data;

  if (!me || me.role !== 'investor' || !me.is_active || me.parent_investor_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!target || target.parent_investor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: inserted, error: insertErr } = await admin
    .from('terminal_team_requests')
    .insert({
      investor_id: user.id,
      request_type: 'permission',
      target_user_id: targetUserId,
      permission_key: permissionKey,
      reason,
      status: 'pending',
    })
    .select('id, created_at')
    .single();

  if (insertErr || !inserted) {
    if (insertErr && /uniq_team_requests_pending_permission|duplicate/i.test(insertErr.message ?? '')) {
      return NextResponse.json(
        { error: 'A pending request for this permission already exists for this team member.' },
        { status: 409 },
      );
    }
    console.error('[team/request-permission] insert failed:', insertErr);
    return NextResponse.json(
      { error: 'We couldn\u2019t submit your request. Please try again.' },
      { status: 500 },
    );
  }

  try {
    await sendTeamRequestAdminNotification({
      requestType: 'permission',
      investorName: me.full_name ?? 'Investor',
      investorEmail: me.email ?? '',
      targetName: target.full_name ?? target.email ?? 'team member',
      targetEmail: target.email ?? '',
      permissionKey: permissionKey as TeamPermissionKey,
      reason,
    });
  } catch (err) {
    console.error('[team/request-permission] admin email failed:', err);
  }

  return NextResponse.json({ success: true, request: inserted });
}
