import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PipelineView from '@/components/admin/PipelineView';
import DealSubNav from '@/components/admin/DealSubNav';

export const metadata = { title: 'Pipeline — RePrime Terminal Admin' };

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('name')
    .eq('id', id)
    .single();

  if (!deal) redirect(`/${locale}/admin/deals`);

  return (
    <div>
      <DealSubNav dealId={id} dealName={deal.name} locale={locale} />
      <PipelineView dealId={id} dealName={deal.name} locale={locale} />
    </div>
  );
}
