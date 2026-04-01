import { createClient } from '@/lib/supabase/server';
import CommitmentsListClient from '@/components/admin/CommitmentsListClient';

export const metadata = { title: 'Commitments — RePrime Terminal Admin' };

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'pending' | 'wire_sent' | 'confirmed' | 'cancelled';

interface CommitmentsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function CommitmentsPage({ params, searchParams }: CommitmentsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.p || '1', 10) || 1);
  const statusFilter: StatusFilter = (
    ['all', 'pending', 'wire_sent', 'confirmed', 'cancelled'].includes(sp.status || '')
      ? sp.status!
      : 'all'
  ) as StatusFilter;

  // Status counts — minimal queries (head: true, count only)
  const [{ count: allCount }, { count: pendingCount }, { count: wireSentCount }, { count: confirmedCount }, { count: cancelledCount }] =
    await Promise.all([
      supabase.from('terminal_deal_commitments').select('*', { count: 'exact', head: true }),
      supabase.from('terminal_deal_commitments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('terminal_deal_commitments').select('*', { count: 'exact', head: true }).eq('status', 'wire_sent'),
      supabase.from('terminal_deal_commitments').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('terminal_deal_commitments').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
    ]);

  const counts = {
    all: allCount ?? 0,
    pending: pendingCount ?? 0,
    wire_sent: wireSentCount ?? 0,
    confirmed: confirmedCount ?? 0,
    cancelled: cancelledCount ?? 0,
  };

  const filteredTotal = counts[statusFilter];
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Fetch only list-needed columns + join investor name and deal name
  let query = supabase
    .from('terminal_deal_commitments')
    .select(`
      id,
      type,
      status,
      created_at,
      terminal_users!user_id ( full_name, email ),
      terminal_deals!deal_id ( name, city, state )
    `)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: commitments } = await query.range(from, to);

  // Flatten the joined data for the client
  const rows = (commitments ?? []).map((c: Record<string, unknown>) => {
    const user = c.terminal_users as { full_name: string; email: string } | null;
    const deal = c.terminal_deals as { name: string; city: string; state: string } | null;
    return {
      id: c.id as string,
      type: c.type as string,
      status: c.status as string,
      created_at: c.created_at as string,
      investor_name: user?.full_name ?? 'Unknown',
      investor_email: user?.email ?? '',
      deal_name: deal?.name ?? 'Unknown',
      deal_location: deal ? `${deal.city}, ${deal.state}` : '',
    };
  });

  return (
    <CommitmentsListClient
      commitments={rows}
      total={filteredTotal}
      page={page}
      statusFilter={statusFilter}
      counts={counts}
      locale={locale}
      pageSize={PAGE_SIZE}
    />
  );
}
