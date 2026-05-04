import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePermissions } from '@/lib/auth/permissions';

export async function GET() {
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
    .select('id, role, parent_investor_id, team_invite_limit, is_active')
    .eq('id', user.id)
    .single();

  if (!me || me.role !== 'investor' || !me.is_active || me.parent_investor_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [membersRes, invitesRes, pendingRequestsRes] = await Promise.all([
    admin
      .from('terminal_users')
      .select('id, email, full_name, phone, company_name, permissions, is_active, created_at, last_active_at')
      .eq('parent_investor_id', user.id)
      .order('created_at', { ascending: false }),
    admin
      .from('terminal_invite_tokens')
      .select('id, email, token, permissions, expires_at, accepted_at, created_at')
      .eq('parent_investor_id', user.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    admin
      .from('terminal_team_requests')
      .select('id, request_type, target_user_id, permission_key, requested_total, status, reason, admin_notes, created_at, reviewed_at')
      .eq('investor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const members = (membersRes.data ?? []).map((m) => ({
    ...m,
    permissions: normalizePermissions(m.permissions),
  }));

  const invites = (invitesRes.data ?? []).map((i) => ({
    ...i,
    permissions: normalizePermissions(i.permissions),
  }));

  return NextResponse.json({
    limit: me.team_invite_limit ?? 10,
    used: members.filter((m) => m.is_active).length + invites.length,
    members,
    invites,
    requests: pendingRequestsRes.data ?? [],
  });
}
