import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { APPROVAL_REQUIRED_KEYS, PERMISSION_KEYS, normalizePermissions } from '@/lib/auth/permissions';
import type { TeamPermissions, TeamPermissionKey } from '@/lib/types/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
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

  const { data: target } = await admin
    .from('terminal_users')
    .select('id, parent_investor_id, permissions, is_active')
    .eq('id', userId)
    .single();

  if (!target || target.parent_investor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const incoming = normalizePermissions(body?.permissions);
  const current = normalizePermissions(target.permissions);

  // Check whether admin has previously approved any approval-required keys
  const { data: approvedRequests } = await admin
    .from('terminal_team_requests')
    .select('permission_key')
    .eq('investor_id', user.id)
    .eq('target_user_id', userId)
    .eq('request_type', 'permission')
    .eq('status', 'approved');

  const approvedKeys = new Set((approvedRequests ?? []).map((r) => r.permission_key));

  const next: TeamPermissions = { ...current };
  for (const key of PERMISSION_KEYS) {
    const k = key as TeamPermissionKey;
    // view_deals always on
    if (k === 'view_deals') {
      next[k] = true;
      continue;
    }
    const desired = incoming[k];
    if (typeof desired !== 'boolean') continue;

    // Approval-required keys: can only be toggled ON if previously approved
    if (APPROVAL_REQUIRED_KEYS.includes(k) && desired === true && !approvedKeys.has(k)) {
      return NextResponse.json(
        {
          error: `Admin approval is required before enabling ${k}. Submit a request from the Team section.`,
          requires_approval: k,
        },
        { status: 403 },
      );
    }
    next[k] = desired;
  }

  const { error: updErr } = await admin
    .from('terminal_users')
    .update({ permissions: next })
    .eq('id', userId);

  if (updErr) {
    console.error('[team/permissions] update failed:', updErr);
    return NextResponse.json(
      { error: 'We couldn\u2019t update permissions. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, permissions: next });
}
