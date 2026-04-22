import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseDealInputs, calculateDeal } from '@/lib/utils/deal-calculator';
import PortalDashboardClient from '@/components/portal/PortalDashboardClient';

export const metadata = { title: 'Active Opportunities — RePrime Terminal Beta' };

/** Parse text column to number, stripping $, commas, whitespace */
function num(val: string | number | null | undefined): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.replace(/[$,%\s]/g, '')) || 0;
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

  // Fetch deals — include new pre-pipeline statuses
  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('id, name, city, state, property_type, purchase_price, noi, cap_rate, irr, coc, dscr, equity_required, seller_financing, note_sale, special_terms, dd_deadline, status, assigned_to, quarter_release, square_footage, units, class_type, year_renovated, psa_draft_start, loi_signed_at, teaser_description, ltv, interest_rate, amortization_years, loan_fee_points, io_period_months, mezz_percent, mezz_rate, mezz_term_months, seller_credit, assignment_fee, acq_fee, asset_mgmt_fee, gp_carry, pref_return, hold_period_years, exit_cap_rate, rent_growth, legal_title_estimate, disposition_cost_pct, capex, area_cap_rate, asking_cap_rate')
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

  // Batch-fetch all enrichment data in parallel (4 queries total instead of 4×N)
  const dealIds = deals.map((d) => d.id);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();

  const [
    { data: allPhotos },
    { data: allViewing },
    { data: allMeetings },
    { data: allCommitments },
  ] = await Promise.all([
    admin
      .from('terminal_deal_photos')
      .select('deal_id, storage_path, display_order')
      .in('deal_id', dealIds)
      .order('display_order', { ascending: true }),
    supabase
      .from('terminal_activity_log')
      .select('deal_id, user_id')
      .in('deal_id', dealIds)
      .eq('action', 'deal_viewed')
      .gte('created_at', twentyFourHoursAgo),
    supabase
      .from('terminal_meetings')
      .select('deal_id')
      .in('deal_id', dealIds)
      .eq('status', 'scheduled'),
    supabase
      .from('terminal_deal_commitments')
      .select('deal_id')
      .in('deal_id', dealIds)
      .in('status', ['pending', 'wire_sent', 'confirmed']),
  ]);

  // Build lookup maps from batch results
  const photoByDeal = new Map<string, string>();
  for (const photo of allPhotos ?? []) {
    if (!photoByDeal.has(photo.deal_id)) {
      photoByDeal.set(photo.deal_id, photo.storage_path);
    }
  }

  const viewersByDeal = new Map<string, Set<string>>();
  for (const v of allViewing ?? []) {
    if (!viewersByDeal.has(v.deal_id)) viewersByDeal.set(v.deal_id, new Set());
    if (v.user_id) viewersByDeal.get(v.deal_id)!.add(v.user_id);
  }

  const meetingsByDeal = new Map<string, number>();
  for (const m of allMeetings ?? []) {
    meetingsByDeal.set(m.deal_id, (meetingsByDeal.get(m.deal_id) ?? 0) + 1);
  }

  const commitmentsByDeal = new Map<string, number>();
  for (const c of allCommitments ?? []) {
    commitmentsByDeal.set(c.deal_id, (commitmentsByDeal.get(c.deal_id) ?? 0) + 1);
  }

  // Enrich deals using lookup maps (no additional queries)
  const enrichedDeals = deals.map((deal) => {
    const storagePath = photoByDeal.get(deal.id);
    let photo_url: string | null = null;
    if (storagePath) {
      const { data: urlData } = admin.storage
        .from('terminal-deal-photos')
        .getPublicUrl(storagePath);
      photo_url = urlData?.publicUrl ?? null;
    }

    // Compute metrics from deal inputs, fall back to stored DB values
    const inputs = parseDealInputs(deal as unknown as Record<string, unknown>);
    const computed = calculateDeal(inputs);

    const dbCapRate = num(deal.cap_rate);
    const dbIrr = num(deal.irr);
    const dbCoc = num(deal.coc);
    const dbDscr = num(deal.dscr);
    const dbEquity = num(deal.equity_required);

    return {
      id: deal.id,
      name: deal.name,
      city: deal.city,
      state: deal.state,
      property_type: deal.property_type,
      purchase_price: num(deal.purchase_price),
      noi: num(deal.noi),
      cap_rate: computed.capRate > 0 ? computed.capRate : dbCapRate,
      irr: computed.irr !== null && computed.irr !== 0 ? computed.irr : dbIrr,
      coc: computed.cocReturn !== null && computed.cocReturn !== 0 ? computed.cocReturn : dbCoc,
      dscr: computed.combinedDSCR > 0 ? computed.combinedDSCR : dbDscr,
      equity_required: computed.netEquity > 0 ? computed.netEquity : dbEquity,
      fully_financed: computed.netEquity <= 0,
      has_positive_cash_flow: computed.distributableCashFlow > 0,
      seller_financing: deal.seller_financing,
      note_sale: deal.note_sale ?? false,
      special_terms: deal.special_terms,
      dd_deadline: deal.dd_deadline,
      status: deal.status,
      assigned_to: deal.assigned_to,
      quarter_release: deal.quarter_release,
      photo_url,
      viewing_count: viewersByDeal.get(deal.id)?.size ?? 0,
      meetings_count: meetingsByDeal.get(deal.id) ?? 0,
      square_footage: deal.square_footage,
      units: deal.units,
      class_type: deal.class_type,
      psa_draft_start: deal.psa_draft_start ?? null,
      loi_signed_at: deal.loi_signed_at ?? null,
      teaser_description: deal.teaser_description ?? null,
      is_subscribed: subscribedDealIds.has(deal.id),
      commitment_count: commitmentsByDeal.get(deal.id) ?? 0,
    };
  });

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
