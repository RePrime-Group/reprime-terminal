import { createClient } from '@/lib/supabase/server';
import ApplicationsListClient from '@/components/admin/ApplicationsListClient';

export const metadata = { title: 'Applications — RePrime Terminal Admin' };

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface ApplicationsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ApplicationsPage({ params, searchParams }: ApplicationsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.p || '1', 10) || 1);
  const statusFilter: StatusFilter = (['all', 'pending', 'approved', 'rejected'].includes(sp.status || '')
    ? sp.status!
    : 'all') as StatusFilter;

  // Status counts
  const [{ count: allCount }, { count: pendingCount }, { count: approvedCount }, { count: rejectedCount }] =
    await Promise.all([
      supabase.from('terminal_membership_applications').select('*', { count: 'exact', head: true }),
      supabase.from('terminal_membership_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('terminal_membership_applications').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('terminal_membership_applications').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);

  const counts = {
    all: allCount ?? 0,
    pending: pendingCount ?? 0,
    approved: approvedCount ?? 0,
    rejected: rejectedCount ?? 0,
  };

  // Filtered + paginated query
  const filteredTotal = counts[statusFilter];
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('terminal_membership_applications')
    .select('id, full_name, email, company_name, status, created_at')
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: applications } = await query.range(from, to);

  return (
    <ApplicationsListClient
      applications={applications ?? []}
      total={filteredTotal}
      page={page}
      statusFilter={statusFilter}
      counts={counts}
      locale={locale}
      pageSize={PAGE_SIZE}
    />
  );
}
