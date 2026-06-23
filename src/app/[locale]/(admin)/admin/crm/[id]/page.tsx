import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type {
  TerminalCrmInvestor,
  TerminalCrmMandate,
  TerminalCrmMessage,
} from '@/lib/types/database';
import CrmInvestorProfileClient, {
  type LinkedAuthUser,
} from '@/components/admin/crm/CrmInvestorProfileClient';

export const metadata = { title: 'Investor — RePrime Terminal Beta Admin' };

interface ProfilePageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function CrmInvestorProfilePage({ params }: ProfilePageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const [{ data: investor }, { data: messages }, { data: mandates }] = await Promise.all([
    supabase.from('terminal_crm_investors').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('terminal_crm_messages')
      .select('*')
      .eq('investor_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('terminal_crm_mandates')
      .select('*')
      .eq('investor_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!investor) notFound();
  const typed = investor as TerminalCrmInvestor;

  // If linked to a terminal_users row, fetch the minimal identity needed for
  // the "Linked to" line in the profile header.
  let linkedUser: LinkedAuthUser | null = null;
  if (typed.auth_user_id) {
    const { data: user } = await supabase
      .from('terminal_users')
      .select('id, full_name, email')
      .eq('id', typed.auth_user_id)
      .maybeSingle();
    if (user) {
      linkedUser = {
        id: user.id as string,
        full_name: (user.full_name as string | null) ?? '',
        email: (user.email as string | null) ?? '',
      };
    }
  }

  return (
    <CrmInvestorProfileClient
      investor={typed}
      mandates={(mandates ?? []) as TerminalCrmMandate[]}
      messages={(messages ?? []) as TerminalCrmMessage[]}
      linkedUser={linkedUser}
      locale={locale}
    />
  );
}
