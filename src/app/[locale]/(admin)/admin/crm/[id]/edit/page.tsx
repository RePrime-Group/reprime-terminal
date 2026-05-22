import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { TerminalCrmInvestor } from '@/lib/types/database';
import CrmInvestorFormClient from '@/components/admin/crm/CrmInvestorFormClient';

export const metadata = { title: 'Edit Investor — RePrime Terminal Beta Admin' };

interface EditInvestorPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function EditInvestorPage({ params }: EditInvestorPageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: investor } = await supabase
    .from('terminal_crm_investors')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!investor) notFound();

  return <CrmInvestorFormClient investor={investor as TerminalCrmInvestor} locale={locale} />;
}
