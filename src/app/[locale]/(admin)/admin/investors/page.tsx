import { createClient } from '@/lib/supabase/server';
import InvestorListClient from '@/components/admin/InvestorListClient';

export const metadata = { title: 'Users — RePrime Terminal Beta Admin' };

const PAGE_SIZE = 10;

interface InvestorsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function InvestorsPage({ params, searchParams }: InvestorsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const tab = sp.tab === 'employees'
    ? 'employees'
    : sp.tab === 'investors'
    ? 'investors'
    : 'invitations';
  const investorPage = Math.max(1, parseInt(sp.ip || '1', 10) || 1);
  const employeePage = Math.max(1, parseInt(sp.ep || '1', 10) || 1);
  const invitationPage = Math.max(1, parseInt(sp.vp || '1', 10) || 1);
  const inviteFilter = (['all', 'pending', 'accepted', 'expired'].includes(sp.status || '')
    ? sp.status!
    : 'all') as 'all' | 'pending' | 'accepted' | 'expired';
  const tierFilter = (['all', 'investor', 'marketplace_only'].includes(sp.tier || '')
    ? sp.tier!
    : 'all') as 'all' | 'investor' | 'marketplace_only';

  // Current user's role (to gate role-change UI)
  const { data: { user: authUser } } = await supabase.auth.getUser();
  let currentUserRole: 'owner' | 'employee' | 'investor' | null = null;
  let currentUserId: string | null = null;
  if (authUser) {
    currentUserId = authUser.id;
    const { data: me } = await supabase
      .from('terminal_users')
      .select('role')
      .eq('id', authUser.id)
      .single();
    currentUserRole = (me?.role ?? null) as typeof currentUserRole;
  }

  // ── Investors (server-paginated) ──
  const investorCountQuery = supabase
    .from('terminal_users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'investor');
  if (tierFilter !== 'all') investorCountQuery.eq('access_tier', tierFilter);
  const { count: investorTotalCount } = await investorCountQuery;

  const investorTotal = investorTotalCount ?? 0;
  const investorFrom = (investorPage - 1) * PAGE_SIZE;
  const investorTo = investorFrom + PAGE_SIZE - 1;

  let investorListQuery = supabase
    .from('terminal_users')
    .select('id, full_name, email, company_name, created_at, last_active_at, is_active, parent_investor_id, access_tier')
    .eq('role', 'investor')
    .order('created_at', { ascending: false })
    .range(investorFrom, investorTo);
  if (tierFilter !== 'all') investorListQuery = investorListQuery.eq('access_tier', tierFilter);
  const { data: investors } = await investorListQuery;

  // Resolve parent names for team members and look up parent is_active state so
  // we can flag "Parent Inactive" in the UI.
  const parentIds = [
    ...new Set((investors ?? []).map((i) => i.parent_investor_id).filter(Boolean) as string[]),
  ];
  const parentMap = new Map<string, { full_name: string; is_active: boolean }>();
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('terminal_users')
      .select('id, full_name, is_active')
      .in('id', parentIds);
    for (const p of parents ?? []) {
      parentMap.set(p.id, { full_name: p.full_name, is_active: p.is_active !== false });
    }
  }

  // Batch fetch blanket-NDA signatures for the visible investors so we can
  // render the NDA status column without an N+1 round trip per row.
  // (KYC was removed as a Terminal access requirement — column dropped.)
  const investorIds = (investors ?? []).map((i) => i.id);
  const ndaSignedSet = new Set<string>();
  if (investorIds.length > 0) {
    const { data: ndaRows } = await supabase
      .from('terminal_nda_signatures')
      .select('user_id')
      .eq('nda_type', 'blanket')
      .in('user_id', investorIds);
    for (const row of ndaRows ?? []) ndaSignedSet.add(row.user_id);
  }

  const investorRows = await Promise.all(
    (investors ?? []).map(async (investor) => {
      const { count } = await supabase
        .from('terminal_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', investor.id)
        .eq('action', 'deal_viewed');

      const parent = investor.parent_investor_id ? parentMap.get(investor.parent_investor_id) : null;

      return {
        id: investor.id,
        full_name: investor.full_name,
        email: investor.email,
        company_name: investor.company_name,
        created_at: investor.created_at,
        last_active_at: investor.last_active_at,
        is_active: investor.is_active !== false,
        parent_investor_id: investor.parent_investor_id ?? null,
        parent_name: parent?.full_name ?? null,
        parent_inactive: !!(investor.parent_investor_id && parent && !parent.is_active),
        deals_viewed: count ?? 0,
        nda_signed: ndaSignedSet.has(investor.id),
        access_tier: (investor.access_tier as 'investor' | 'marketplace_only' | null) ?? 'investor',
      };
    })
  );

  // ── Employees (server-paginated) ──
  const { count: employeeTotalCount } = await supabase
    .from('terminal_users')
    .select('*', { count: 'exact', head: true })
    .in('role', ['employee', 'owner']);

  const employeeTotal = employeeTotalCount ?? 0;
  const employeeFrom = (employeePage - 1) * PAGE_SIZE;
  const employeeTo = employeeFrom + PAGE_SIZE - 1;

  const { data: employees } = await supabase
    .from('terminal_users')
    .select('id, full_name, email, role, company_name, created_at, last_active_at, is_active')
    .in('role', ['employee', 'owner'])
    .order('created_at', { ascending: false })
    .range(employeeFrom, employeeTo);

  const employeeRows = (employees ?? []).map((emp) => ({
    id: emp.id,
    full_name: emp.full_name,
    email: emp.email,
    role: emp.role as 'owner' | 'employee',
    company_name: emp.company_name,
    created_at: emp.created_at,
    last_active_at: emp.last_active_at,
    is_active: emp.is_active !== false,
  }));

  // ── Invitations: status counts (for dropdown) ──
  const now = new Date().toISOString();

  const [{ count: allCount }, { count: pendingCount }, { count: acceptedCount }, { count: expiredCount }] =
    await Promise.all([
      supabase.from('terminal_invite_tokens').select('*', { count: 'exact', head: true }),
      supabase.from('terminal_invite_tokens').select('*', { count: 'exact', head: true }).is('accepted_at', null).gt('expires_at', now),
      supabase.from('terminal_invite_tokens').select('*', { count: 'exact', head: true }).not('accepted_at', 'is', null),
      supabase.from('terminal_invite_tokens').select('*', { count: 'exact', head: true }).is('accepted_at', null).lte('expires_at', now),
    ]);

  const counts = {
    all: allCount ?? 0,
    pending: pendingCount ?? 0,
    accepted: acceptedCount ?? 0,
    expired: expiredCount ?? 0,
  };

  // ── Invitations: filtered + paginated ──
  const filteredTotal = counts[inviteFilter];
  const invFrom = (invitationPage - 1) * PAGE_SIZE;
  const invTo = invFrom + PAGE_SIZE - 1;

  let invQuery = supabase
    .from('terminal_invite_tokens')
    .select('id, email, role, token, accepted_at, expires_at, created_at')
    .order('created_at', { ascending: false });

  if (inviteFilter === 'pending') {
    invQuery = invQuery.is('accepted_at', null).gt('expires_at', now);
  } else if (inviteFilter === 'accepted') {
    invQuery = invQuery.not('accepted_at', 'is', null);
  } else if (inviteFilter === 'expired') {
    invQuery = invQuery.is('accepted_at', null).lte('expires_at', now);
  }

  const { data: invitations } = await invQuery.range(invFrom, invTo);

  return (
    <InvestorListClient
      investors={investorRows}
      investorTotal={investorTotal}
      investorPage={investorPage}
      employees={employeeRows}
      employeeTotal={employeeTotal}
      employeePage={employeePage}
      invitations={invitations ?? []}
      invitationTotal={filteredTotal}
      invitationPage={invitationPage}
      inviteFilter={inviteFilter}
      inviteCounts={counts}
      locale={locale}
      tab={tab}
      pageSize={PAGE_SIZE}
      currentUserRole={currentUserRole}
      currentUserId={currentUserId}
      tierFilter={tierFilter}
    />
  );
}
