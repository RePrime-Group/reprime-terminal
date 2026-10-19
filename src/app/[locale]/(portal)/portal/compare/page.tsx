import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import CompareClient from '@/components/portal/CompareClient';
import { ACTIVE_DEAL_STATUSES } from '@/lib/constants';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portal.compare' });
  return { title: `${t('title')} — RePrime Terminal Beta` };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  // Only fetch what the dropdowns need
  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('id, name, city, state, cap_rate')
    .in('status', [...ACTIVE_DEAL_STATUSES, 'assigned', 'coming_soon'])
    .order('name', { ascending: true });

  return <CompareClient dealOptions={deals ?? []} locale={locale} />;
}
