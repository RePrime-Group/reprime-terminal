import { createAdminClient } from '@/lib/supabase/admin';
import CriteriaFormClient, {
  type CriteriaFormInitialValue,
} from '@/components/criteria/CriteriaFormClient';
import CriteriaInvalidLink from '@/components/criteria/CriteriaInvalidLink';
import { mandateRowToInput } from '@/components/admin/crm/mandate';
import type {
  CrmContactMethod,
  CrmInvestingAs,
  CrmOwnershipPref,
  TerminalCrmInvestor,
  TerminalCrmMandate,
} from '@/lib/types/database';

export const metadata = { title: 'Investor Criteria — RePrime' };
// Token-gated form; the response varies per token + must never be cached.
export const dynamic = 'force-dynamic';

interface CriteriaPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; invalid?: string }>;
}

export default async function CriteriaPage({ params, searchParams }: CriteriaPageProps) {
  const { locale } = await params;
  const sp = await searchParams;

  // ?invalid=used short-circuit — used by the client when a token is burned
  // mid-flight (e.g. submitted in another tab).
  if (sp.invalid === 'used') {
    return <CriteriaInvalidLink locale={locale} reason="used" />;
  }

  const token = sp.token?.trim();
  if (!token) {
    return <CriteriaInvalidLink locale={locale} reason="missing" />;
  }

  // Service-role lookup: the public form needs to bypass RLS to read its own
  // investor row by token. The token IS the credential.
  const admin = createAdminClient();
  const { data: investor } = await admin
    .from('terminal_crm_investors')
    .select('*')
    .eq('submission_token', token)
    .maybeSingle();

  if (!investor) {
    return <CriteriaInvalidLink locale={locale} reason="unknown" />;
  }

  const typed = investor as TerminalCrmInvestor;
  const { data: mandateRows } = await admin
    .from('terminal_crm_mandates')
    .select('*')
    .eq('investor_id', typed.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const mandates = ((mandateRows ?? []) as TerminalCrmMandate[]).map(mandateRowToInput);

  const initial: CriteriaFormInitialValue = {
    token,
    identity: {
      first_name: typed.first_name ?? '',
      last_name: typed.last_name ?? '',
      email: typed.email ?? '',
      phone: typed.phone ?? '',
      whatsapp: typed.whatsapp ?? '',
      company_name: typed.company_name ?? '',
      title: typed.title ?? '',
      preferred_contact_method: (typed.preferred_contact_method ?? 'email') as CrmContactMethod,
      investing_as: (typed.investing_as ?? '') as CrmInvestingAs | '',
      capital_ready: typed.capital_ready ?? '',
      ownership_pref: (typed.ownership_pref ?? '') as CrmOwnershipPref | '',
      timeline_to_deploy: typed.timeline_to_deploy ?? '',
      is_accredited: typed.is_accredited ?? false,
    },
    mandates,
  };

  return <CriteriaFormClient locale={locale} initial={initial} />;
}
