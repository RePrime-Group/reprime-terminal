import { createClient } from '@/lib/supabase/server';
import InvestorListClient from '@/components/admin/InvestorListClient';

export const metadata = { title: 'Investors — RePrime Terminal Admin' };

interface InvestorsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function InvestorsPage({ params }: InvestorsPageProps) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: investors } = await supabase
    .from('terminal_users')
    .select('id, full_name, email, company_name, created_at, last_active_at')
    .eq('role', 'investor')
    .order('created_at', { ascending: false });

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

  return <InvestorListClient investors={investorRows} locale={locale} />;
}
