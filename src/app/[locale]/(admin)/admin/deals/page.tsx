import { createClient } from '@/lib/supabase/server';
import type { TerminalDeal } from '@/lib/types/database';
import DealListClient from '@/components/admin/DealListClient';

export const metadata = { title: 'Deals — RePrime Terminal Admin' };

export default async function DealsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <DealListClient
      deals={(deals as TerminalDeal[]) ?? []}
      locale={locale}
    />
  );
}
