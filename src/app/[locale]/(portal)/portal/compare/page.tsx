import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CompareClient from '@/components/portal/CompareClient';

export const metadata = { title: 'Deal Comparison — RePrime Terminal' };

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
    .in('status', ['published', 'assigned', 'coming_soon', 'loi_signed'])
    .order('name', { ascending: true });

  return <CompareClient dealOptions={deals ?? []} locale={locale} />;
}
