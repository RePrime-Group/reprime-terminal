import { createClient } from '@/lib/supabase/server';
import ActivityLogClient from '@/components/admin/ActivityLogClient';
import type { ActivityAction, UserRole } from '@/lib/types/database';

export const metadata = { title: 'Activity — RePrime Terminal Beta Admin' };

interface ActivityPageProps {
  params: Promise<{ locale: string }>;
}

interface ActivityJoinRow {
  id: string;
  created_at: string;
  action: ActivityAction;
  metadata: Record<string, unknown>;
  terminal_users: { full_name: string; role: UserRole } | null;
  terminal_deals: { name: string } | null;
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  await params;
  const supabase = await createClient();

  const { data: activityRaw } = await supabase
    .from('terminal_activity_log')
    .select('id, created_at, action, metadata, terminal_users(full_name, role), terminal_deals(name)')
    .order('created_at', { ascending: false })
    .limit(1000);

  const activities = (activityRaw as ActivityJoinRow[] | null ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    action: row.action,
    metadata: row.metadata,
    user_name: row.terminal_users?.full_name ?? null,
    user_role: row.terminal_users?.role ?? null,
    deal_name: row.terminal_deals?.name ?? null,
  }));

  const { data: users } = await supabase
    .from('terminal_users')
    .select('id, full_name, role')
    .order('full_name');

  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('id, name')
    .order('name');

  const filterOptions = {
    users: (users ?? []).map((u) => ({
      id: u.id,
      name: u.full_name,
      role: u.role as UserRole,
    })),
    deals: (deals ?? []).map((d) => ({ id: d.id, name: d.name })),
  };

  return <ActivityLogClient activities={activities} filterOptions={filterOptions} />;
}
