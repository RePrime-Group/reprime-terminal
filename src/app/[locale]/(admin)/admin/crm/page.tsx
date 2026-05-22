import { createClient } from '@/lib/supabase/server';
import type { TerminalCrmInvestorSummary } from '@/lib/types/database';
import CrmInvestorListClient from '@/components/admin/crm/CrmInvestorListClient';

export const metadata = { title: 'Investor CRM — RePrime Terminal Beta Admin' };

interface CrmPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CrmPage({ params }: CrmPageProps) {
  const { locale } = await params;
  const supabase = await createClient();

  // The summary view already excludes archived investors and carries the
  // derived message/follow-up/pinned counts used by the cards + stats bar.
  const { data } = await supabase
    .from('terminal_crm_investor_summary')
    .select('*')
    .order('last_contacted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const investors = (data ?? []) as TerminalCrmInvestorSummary[];

  return <CrmInvestorListClient investors={investors} locale={locale} />;
}
