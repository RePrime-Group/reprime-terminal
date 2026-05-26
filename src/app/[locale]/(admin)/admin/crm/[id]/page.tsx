import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { TerminalCrmInvestor, TerminalCrmMessage } from '@/lib/types/database';
import CrmInvestorProfileClient from '@/components/admin/crm/CrmInvestorProfileClient';

export const metadata = { title: 'Investor — RePrime Terminal Beta Admin' };

interface ProfilePageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function CrmInvestorProfilePage({ params }: ProfilePageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const [{ data: investor }, { data: messages }] = await Promise.all([
    supabase.from('terminal_crm_investors').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('terminal_crm_messages')
      .select('*')
      .eq('investor_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (!investor) notFound();

  return (
    <CrmInvestorProfileClient
      investor={investor as TerminalCrmInvestor}
      messages={(messages ?? []) as TerminalCrmMessage[]}
      locale={locale}
    />
  );
}
