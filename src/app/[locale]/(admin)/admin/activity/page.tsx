import { createClient } from '@/lib/supabase/server';
import ActivityLogClient from '@/components/admin/ActivityLogClient';
import type { ActivityAction } from '@/lib/types/database';

export const metadata = { title: 'Activity — RePrime Terminal Admin' };

interface ActivityPageProps {
  params: Promise<{ locale: string }>;
}

interface ActivityJoinRow {
  id: string;
  created_at: string;
  action: ActivityAction;
  metadata: Record<string, unknown>;
  terminal_users: { full_name: string } | null;
  terminal_deals: { name: string } | null;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  await params;
  const supabase = await createClient();

  const { data: activityRaw } = await supabase
    .from('terminal_activity_log')
    .select('id, created_at, action, metadata, terminal_users(full_name), terminal_deals(name)')
    .order('created_at', { ascending: false })
    .limit(1000);

  const activities = (activityRaw as ActivityJoinRow[] | null ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    action: row.action,
    metadata: row.metadata,
    investor_name: row.terminal_users?.full_name ?? null,
    deal_name: row.terminal_deals?.name ?? null,
  }));

  // Build filter options from the data
  const investorMap = new Map<string, string>();
  const dealMap = new Map<string, string>();

  for (const a of activities) {
    if (a.investor_name) investorMap.set(a.investor_name, a.investor_name);
    if (a.deal_name) dealMap.set(a.deal_name, a.deal_name);
  }

  const { data: investors } = await supabase
    .from('terminal_users')
    .select('id, full_name')
    .eq('role', 'investor')
    .order('full_name');

  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('id, name')
    .order('name');

  const filterOptions = {
    investors: (investors ?? []).map((i) => ({ id: i.id, name: i.full_name })),
    deals: (deals ?? []).map((d) => ({ id: d.id, name: d.name })),
  };

  return <ActivityLogClient activities={activities} filterOptions={filterOptions} />;
}
