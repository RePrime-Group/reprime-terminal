import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PortalDashboardClient from '@/components/portal/PortalDashboardClient';

interface DealWithMeta {
  id: string;
  name: string;
  city: string;
  state: string;
  property_type: string;
  purchase_price: number;
  noi: number;
  cap_rate: number;
  irr: number;
  coc: number;
  dscr: number;
  equity_required: number;
  seller_financing: boolean;
  special_terms: string | null;
  dd_deadline: string | null;
  status: string;
  assigned_to: string | null;
  quarter_release: string | null;
  photo_url: string | null;
  viewing_count: number;
  meetings_count: number;
}

export default async function PortalDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  // Fetch deals with status published, assigned, or closed
  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('*')
    .in('status', ['published', 'assigned', 'closed'])
    .order('dd_deadline', { ascending: true });

  if (!deals || deals.length === 0) {
    return (
      <PortalDashboardClient deals={[]} locale={locale} />
    );
  }

  // Enrich each deal with photo, viewing count, and meetings count
  const enrichedDeals: DealWithMeta[] = await Promise.all(
    deals.map(async (deal) => {
      // Fetch first photo
      const { data: photos } = await supabase
        .from('terminal_deal_photos')
        .select('storage_path')
        .eq('deal_id', deal.id)
        .order('display_order', { ascending: true })
        .limit(1);

      let photo_url: string | null = null;
      if (photos && photos.length > 0) {
        const { data: urlData } = supabase.storage
          .from('deal-photos')
          .getPublicUrl(photos[0].storage_path);
        photo_url = urlData?.publicUrl ?? null;
      }

      // Fetch viewing count (distinct users in last 24 hours)
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: viewingData } = await supabase
        .from('terminal_activity_log')
        .select('user_id')
        .eq('deal_id', deal.id)
        .eq('action', 'deal_viewed')
        .gte('created_at', twentyFourHoursAgo);

      const uniqueViewers = new Set(viewingData?.map((v) => v.user_id) ?? []);
      const viewing_count = uniqueViewers.size;

      // Fetch meetings count
      const { count: meetings_count } = await supabase
        .from('terminal_meetings')
        .select('*', { count: 'exact', head: true })
        .eq('deal_id', deal.id)
        .eq('status', 'scheduled');

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
        seller_financing: deal.seller_financing,
        special_terms: deal.special_terms,
        dd_deadline: deal.dd_deadline,
        status: deal.status,
        assigned_to: deal.assigned_to,
        quarter_release: deal.quarter_release,
        photo_url,
        viewing_count,
        meetings_count: meetings_count ?? 0,
      };
    })
  );

  // Sort: active (published) first by dd_deadline ASC, then assigned/closed
  const sorted = enrichedDeals.sort((a, b) => {
    const statusOrder: Record<string, number> = { published: 0, assigned: 1, closed: 2 };
    const orderA = statusOrder[a.status] ?? 1;
    const orderB = statusOrder[b.status] ?? 1;
    if (orderA !== orderB) return orderA - orderB;

    // Within same status group, sort by dd_deadline ascending
    if (a.dd_deadline && b.dd_deadline) {
      return new Date(a.dd_deadline).getTime() - new Date(b.dd_deadline).getTime();
    }
    if (a.dd_deadline) return -1;
    if (b.dd_deadline) return 1;
    return 0;
  });

  return (
    <PortalDashboardClient deals={sorted} locale={locale} />
  );
}
