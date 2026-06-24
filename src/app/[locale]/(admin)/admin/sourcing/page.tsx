import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { TerminalCrmInvestor, TerminalCrmMandate } from '@/lib/types/database';
import SourcingPageClient, {
  type SourcingInvestorOption,
  type SourcingMandateOption,
  type SourcingTabOption,
} from '@/components/admin/sourcing/SourcingPageClient';

export const metadata = { title: 'Sourcing — RePrime Terminal Beta Admin' };

interface SourcingPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mandate?: string }>;
}

export default async function SourcingPage({ params, searchParams }: SourcingPageProps) {
  const { locale } = await params;
  const { mandate: preselectedMandateId } = await searchParams;
  const supabase = await createClient();

  // Owner/employee gate.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || (profile.role !== 'owner' && profile.role !== 'employee')) {
    redirect(`/${locale}/portal/dashboard`);
  }

  // Fetch active mandates + investor identities + enabled groups in parallel.
  const [{ data: mandateRows }, { data: investorRows }, { data: tabRows }] = await Promise.all([
    supabase
      .from('terminal_crm_mandates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    supabase
      .from('terminal_crm_investors')
      .select('id, first_name, last_name, company_name')
      .eq('is_archived', false)
      .order('first_name', { ascending: true }),
    supabase
      .from('terminal_investor_tabs')
      .select('id, name, is_enabled')
      .eq('is_enabled', true)
      .order('name', { ascending: true }),
  ]);

  const mandates = (mandateRows ?? []) as TerminalCrmMandate[];
  const investors = (investorRows ?? []) as Pick<
    TerminalCrmInvestor,
    'id' | 'first_name' | 'last_name' | 'company_name'
  >[];

  // Keep only investors that have ≥1 active mandate, so the picker isn't
  // cluttered with leads who haven't submitted criteria.
  const investorsWithMandates: SourcingInvestorOption[] = investors
    .filter((inv) => mandates.some((m) => m.investor_id === inv.id))
    .map((inv) => ({
      id: inv.id,
      label: [inv.first_name, inv.last_name].filter(Boolean).join(' ').trim() || inv.company_name || '—',
      company: inv.company_name ?? null,
    }));

  const mandateOptions: SourcingMandateOption[] = mandates.map((m) => ({
    id: m.id,
    investorId: m.investor_id,
    label: m.label ?? 'Mandate',
    raw: m,
  }));

  const tabOptions: SourcingTabOption[] = (tabRows ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
  }));

  // Server-only env; the value itself isn't sensitive (rendered as href on
  // each row) but we don't need a separate NEXT_PUBLIC_* alias.
  const portalBaseUrl = (process.env.REPRIME_PORTAL_BASE_URL ?? '').replace(/\/$/, '');

  return (
    <SourcingPageClient
      locale={locale}
      investors={investorsWithMandates}
      mandates={mandateOptions}
      tabs={tabOptions}
      portalBaseUrl={portalBaseUrl}
      preselectedMandateId={preselectedMandateId ?? null}
    />
  );
}
