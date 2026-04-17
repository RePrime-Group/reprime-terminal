import { createClient } from '@/lib/supabase/server';
import InvestorListClient from '@/components/admin/InvestorListClient';

export const metadata = { title: 'Investors — RePrime Terminal Beta Admin' };

const PAGE_SIZE = 10;

interface InvestorsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function InvestorsPage({ params, searchParams }: InvestorsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const tab = sp.tab === 'investors' ? 'investors' : 'invitations';
  const investorPage = Math.max(1, parseInt(sp.ip || '1', 10) || 1);
  const invitationPage = Math.max(1, parseInt(sp.vp || '1', 10) || 1);
  const inviteFilter = (['all', 'pending', 'accepted', 'expired'].includes(sp.status || '')
    ? sp.status!
    : 'all') as 'all' | 'pending' | 'accepted' | 'expired';

  // ── Investors (server-paginated) ──
  const { count: investorTotalCount } = await supabase
    .from('terminal_users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'investor');

  const investorTotal = investorTotalCount ?? 0;
  const investorFrom = (investorPage - 1) * PAGE_SIZE;
  const investorTo = investorFrom + PAGE_SIZE - 1;

  const { data: investors } = await supabase
    .from('terminal_users')
    .select('id, full_name, email, company_name, created_at, last_active_at')
    .eq('role', 'investor')
    .order('created_at', { ascending: false })
    .range(investorFrom, investorTo);

  const investorRows = await Promise.all(
    (investors ?? []).map(async (investor) => {
      const { count } = await supabase
        .from('terminal_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', investor.id)
        .eq('action', 'deal_viewed');

      return {
        id: investor.id,
        full_name: investor.full_name,
        email: investor.email,
        company_name: investor.company_name,
        created_at: investor.created_at,
        last_active_at: investor.last_active_at,
        deals_viewed: count ?? 0,
      };
    })
  );

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
      invitations={invitations ?? []}
      invitationTotal={filteredTotal}
      invitationPage={invitationPage}
      inviteFilter={inviteFilter}
      inviteCounts={counts}
      locale={locale}
      tab={tab}
      pageSize={PAGE_SIZE}
    />
  );
}
