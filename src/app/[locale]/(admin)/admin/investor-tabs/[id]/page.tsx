import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import InvestorTabDetailClient from '@/components/admin/investor-tabs/InvestorTabDetailClient';
import type {
  AssignedDealRow,
  MemberRow,
  PickableDeal,
  PickableInvestor,
} from '@/components/admin/investor-tabs/types';

export const metadata = { title: 'Investor Group — RePrime Terminal Beta Admin' };

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function InvestorTabDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: tab } = await supabase
    .from('terminal_investor_tabs')
    .select('id, name, is_enabled, hero_note')
    .eq('id', id)
    .maybeSingle();

  if (!tab) notFound();

  const [{ data: memberRows }, { data: assignmentRows }, { data: investorRows }, { data: dealRows }] =
    await Promise.all([
      supabase
        .from('terminal_investor_tab_members')
        .select('user_id, user:terminal_users!terminal_investor_tab_members_user_id_fkey(full_name, email)')
        .eq('tab_id', id),
      supabase
        .from('terminal_deal_tab_assignments')
        .select('deal_id, status, match_reason, internal_note, display_order, deal:terminal_deals(name, status, city, state)')
        .eq('tab_id', id)
        .order('display_order', { ascending: true }),
      supabase
        .from('terminal_users')
        .select('id, full_name, email')
        .eq('role', 'investor')
        .order('full_name', { ascending: true }),
      supabase
        .from('terminal_deals')
        .select('id, name, status, city, state')
        .order('created_at', { ascending: false }),
    ]);

  // Supabase types the joined relation as an array; collapse to the single row.
  const members: MemberRow[] = (memberRows ?? []).map((m) => {
    const user = Array.isArray(m.user) ? m.user[0] : m.user;
    return {
      user_id: m.user_id,
      full_name: user?.full_name ?? null,
      email: user?.email ?? null,
    };
  });

  const assignedDeals: AssignedDealRow[] = (assignmentRows ?? []).map((a) => {
    const deal = Array.isArray(a.deal) ? a.deal[0] : a.deal;
    return {
      deal_id: a.deal_id,
      name: deal?.name ?? '',
      status: deal?.status ?? '',
      city: deal?.city ?? null,
      state: deal?.state ?? null,
      match_reason: a.match_reason,
      internal_note: a.internal_note,
      display_order: a.display_order,
    };
  });

  const investors: PickableInvestor[] = investorRows ?? [];
  const deals: PickableDeal[] = dealRows ?? [];

  return (
    <InvestorTabDetailClient
      group={{ id: tab.id, name: tab.name, is_enabled: tab.is_enabled, hero_note: tab.hero_note }}
      members={members}
      assignedDeals={assignedDeals}
      allInvestors={investors}
      allDeals={deals}
      locale={locale}
    />
  );
}
