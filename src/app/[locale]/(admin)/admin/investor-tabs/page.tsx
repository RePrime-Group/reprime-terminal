import { createClient } from '@/lib/supabase/server';
import InvestorTabListClient from '@/components/admin/investor-tabs/InvestorTabListClient';
import type { GroupSummary } from '@/components/admin/investor-tabs/types';

export const metadata = { title: 'Investor Groups — RePrime Terminal Beta Admin' };

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function InvestorTabsPage({ params }: PageProps) {
  const { locale } = await params;
  const supabase = await createClient();

  // Staff RLS (FOR ALL) lets owners/employees read every group, member, and
  // assignment. Counts are aggregated in JS to avoid group-by round-trips.
  const [{ data: tabs }, { data: members }, { data: assignments }] = await Promise.all([
    supabase
      .from('terminal_investor_tabs')
      .select('id, name, is_enabled, hero_note, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('terminal_investor_tab_members').select('tab_id'),
    supabase.from('terminal_deal_tab_assignments').select('tab_id, status'),
  ]);

  const memberCount = new Map<string, number>();
  for (const m of members ?? []) {
    memberCount.set(m.tab_id, (memberCount.get(m.tab_id) ?? 0) + 1);
  }

  const dealCount = new Map<string, number>();
  for (const a of assignments ?? []) {
    if (a.status !== 'active') continue;
    dealCount.set(a.tab_id, (dealCount.get(a.tab_id) ?? 0) + 1);
  }

  const groups: GroupSummary[] = (tabs ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    is_enabled: t.is_enabled,
    hero_note: t.hero_note,
    created_at: t.created_at,
    member_count: memberCount.get(t.id) ?? 0,
    deal_count: dealCount.get(t.id) ?? 0,
  }));

  return <InvestorTabListClient groups={groups} locale={locale} />;
}
