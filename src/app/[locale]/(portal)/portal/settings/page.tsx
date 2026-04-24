import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizePrefs } from '@/lib/notifications/types';
import SettingsClient from '@/components/portal/SettingsClient';
import { getGlobalFeeDefaults } from '@/lib/utils/fee-resolver';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [{ data }, { data: investmentTermsRow }, globalFeeDefaults] = await Promise.all([
    supabase
      .from('terminal_users')
      .select('full_name, email, phone, company_name, notification_preferences, parent_investor_id')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_investment_terms')
      .select('assignment_fee, acq_fee, asset_mgmt_fee, gp_carry, pref_return')
      .eq('user_id', user.id)
      .maybeSingle(),
    getGlobalFeeDefaults(supabase),
  ]);

  let parentName: string | null = null;
  if (data?.parent_investor_id) {
    const { data: parent } = await supabase
      .from('terminal_users')
      .select('full_name, company_name')
      .eq('id', data.parent_investor_id)
      .single();
    parentName = parent?.full_name ?? parent?.company_name ?? null;
  }

  return (
    <SettingsClient
      initialProfile={{
        full_name: data?.full_name ?? '',
        email: data?.email ?? user.email ?? '',
        phone: data?.phone ?? '',
        company_name: data?.company_name ?? '',
      }}
      initialPrefs={normalizePrefs(data?.notification_preferences)}
      isSubUser={!!data?.parent_investor_id}
      parentName={parentName}
      locale={locale}
      initialInvestmentTerms={{
        assignment_fee: investmentTermsRow?.assignment_fee ?? '',
        acq_fee: investmentTermsRow?.acq_fee ?? '',
        asset_mgmt_fee: investmentTermsRow?.asset_mgmt_fee ?? '',
        gp_carry: investmentTermsRow?.gp_carry ?? '',
        pref_return: investmentTermsRow?.pref_return ?? '',
      }}
      globalFeeDefaults={globalFeeDefaults}
    />
  );
}