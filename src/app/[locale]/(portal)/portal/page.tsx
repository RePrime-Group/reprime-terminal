import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PortalDashboardClient from '@/components/portal/PortalDashboardClient';

export const metadata = { title: 'Active Opportunities — RePrime Terminal' };

export default async function PortalDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  // Fetch deals — include new pre-pipeline statuses
  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('*')
    .in('status', ['coming_soon', 'loi_signed', 'published', 'assigned', 'closed'])
    .order('created_at', { ascending: false });

  if (!deals || deals.length === 0) {
    return (
      <PortalDashboardClient deals={[]} locale={locale} />
    );
  }

  // Fetch user's subscriptions for Coming Soon deals
  const { data: subscriptions } = await supabase
    .from('terminal_deal_subscriptions')
    .select('deal_id')
    .eq('user_id', user.id);

  const subscribedDealIds = new Set(subscriptions?.map((s) => s.deal_id) ?? []);

  // Enrich each deal
  const enrichedDeals = await Promise.all(
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
          .from('terminal-deal-photos')
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
        purchase_price: parseFloat(deal.purchase_price) || 0,
        noi: parseFloat(deal.noi) || 0,
        cap_rate: parseFloat(deal.cap_rate) || 0,
        irr: parseFloat(deal.irr) || 0,
        coc: parseFloat(deal.coc) || 0,
        dscr: parseFloat(deal.dscr) || 0,
        equity_required: parseFloat(deal.equity_required) || 0,
        seller_financing: deal.seller_financing,
        special_terms: deal.special_terms,
        dd_deadline: deal.dd_deadline,
        status: deal.status,
        assigned_to: deal.assigned_to,
        quarter_release: deal.quarter_release,
        photo_url,
        viewing_count,
        meetings_count: meetings_count ?? 0,
        square_footage: deal.square_footage,
        units: deal.units,
        class_type: deal.class_type,
        // Pre-pipeline fields
        psa_draft_start: deal.psa_draft_start ?? null,
        loi_signed_at: deal.loi_signed_at ?? null,
        teaser_description: deal.teaser_description ?? null,
        is_subscribed: subscribedDealIds.has(deal.id),
      };
    })
  );

  // Sort: upcoming first, then active by dd_deadline, then closed
  const sorted = enrichedDeals.sort((a, b) => {
    const statusOrder: Record<string, number> = {
      coming_soon: 0, loi_signed: 1, published: 2, assigned: 3, closed: 4,
    };
    const orderA = statusOrder[a.status] ?? 2;
    const orderB = statusOrder[b.status] ?? 2;
    if (orderA !== orderB) return orderA - orderB;

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
