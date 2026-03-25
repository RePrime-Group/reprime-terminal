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

  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('*')
    .in('status', ['published', 'assigned', 'coming_soon', 'loi_signed'])
    .order('name', { ascending: true });

  // Get first photo for each deal
  const enrichedDeals = await Promise.all(
    (deals ?? []).map(async (deal) => {
      const { data: photos } = await supabase
        .from('terminal_deal_photos')
        .select('storage_path')
        .eq('deal_id', deal.id)
        .order('display_order', { ascending: true })
        .limit(1);

      let photo_url: string | null = null;
      if (photos && photos.length > 0) {
        const { data: urlData } = supabase.storage
          .from('terminal-deal-photos')
          .getPublicUrl(photos[0].storage_path);
        photo_url = urlData?.publicUrl ?? null;
      }

      return {
        id: deal.id,
        name: deal.name,
        city: deal.city,
        state: deal.state,
        property_type: deal.property_type,
        purchase_price: deal.purchase_price,
        noi: deal.noi,
        cap_rate: deal.cap_rate,
        irr: deal.irr,
        coc: deal.coc,
        dscr: deal.dscr,
        equity_required: deal.equity_required,
        square_footage: deal.square_footage,
        units: deal.units,
        class_type: deal.class_type,
        year_built: deal.year_built,
        occupancy: deal.occupancy,
        seller_financing: deal.seller_financing,
        deposit_amount: deal.deposit_amount,
        photo_url,
      };
    })
  );

  return <CompareClient deals={enrichedDeals} locale={locale} />;
}
