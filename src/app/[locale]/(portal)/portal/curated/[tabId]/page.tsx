import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseDealInputs, calculatePropertyMetrics } from '@/lib/utils/deal-calculator';
import CuratedTabClient from '@/components/portal/curated/CuratedTabClient';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

export const metadata = { title: 'Your Pipeline — RePrime Terminal Beta' };

/** Parse text column to number, stripping $, commas, whitespace */
function num(val: string | number | null | undefined): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.replace(/[$,%\s]/g, '')) || 0;
}

const DEAL_FIELDS =
  'id, name, address, city, state, property_type, purchase_price, noi, cap_rate, irr, coc, dscr, equity_required, occupancy, seller_financing, note_sale, special_terms, dd_deadline, close_deadline, status, assigned_to, quarter_release, square_footage, units, class_type, year_renovated, psa_draft_start, loi_signed_at, teaser_description, deposit_amount, ltv, interest_rate, amortization_years, loan_fee_points, io_period_months, mezz_percent, mezz_rate, mezz_term_months, seller_credit, assignment_fee, acq_fee, asset_mgmt_fee, gp_carry, pref_return, hold_period_years, exit_cap_rate, rent_growth, legal_title_estimate, disposition_cost_pct, capex, area_cap_rate, asking_cap_rate';

interface PageProps {
  params: Promise<{ locale: string; tabId: string }>;
}

export default async function CuratedTabPage({ params }: PageProps) {
  const { locale, tabId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  // RLS confirms membership + enabled. A non-member gets no row → notFound().
  const [{ data: tab }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from('terminal_investor_tabs')
      .select('id, name, hero_note')
      .eq('id', tabId)
      .maybeSingle(),
    supabase
      .from('terminal_deal_tab_assignments')
      .select(`deal_id, match_reason, display_order, deal:terminal_deals(${DEAL_FIELDS})`)
      .eq('tab_id', tabId)
      .eq('status', 'active')
      .order('display_order', { ascending: true }),
  ]);

  if (!tab) notFound();

  // Flatten the embedded deal, drop drafts, keep curated order.
  type Raw = Record<string, unknown>;
  const rawDeals = (assignmentRows ?? [])
    .map((a) => {
      const deal = (Array.isArray(a.deal) ? a.deal[0] : a.deal) as Raw | null;
      return deal ? { deal, match_reason: a.match_reason as string | null } : null;
    })
    .filter((x): x is { deal: Raw; match_reason: string | null } => x !== null)
    .filter((x) => x.deal.status !== 'draft');

  if (rawDeals.length === 0) {
    return <CuratedTabClient tabId={tabId} tabName={tab.name} heroNote={tab.hero_note} deals={[]} locale={locale} />;
  }

  // Enrichment — identical pattern to the Dashboard (admin client only for the
  // cross-deal photo aggregate; everything else through the RLS cookie client).
  const dealIds = rawDeals.map((x) => x.deal.id as string);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient();

  const [{ data: allPhotos }, { data: allViewing }, { data: allMeetings }, { data: allCommitments }, { data: allNotes }] =
    await Promise.all([
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
      supabase.from('terminal_meetings').select('deal_id').in('deal_id', dealIds).eq('status', 'scheduled'),
      supabase
        .from('terminal_deal_commitments')
        .select('deal_id')
        .in('deal_id', dealIds)
        .in('status', ['pending', 'wire_sent', 'confirmed']),
      supabase
        .from('user_deal_notes')
        .select('deal_id, content, updated_at')
        .eq('user_id', user.id)
        .in('deal_id', dealIds),
    ]);

  const photoByDeal = new Map<string, string>();
  for (const photo of allPhotos ?? []) {
    if (!photoByDeal.has(photo.deal_id)) photoByDeal.set(photo.deal_id, photo.storage_path);
  }
  const viewersByDeal = new Map<string, Set<string>>();
  for (const v of allViewing ?? []) {
    if (!viewersByDeal.has(v.deal_id)) viewersByDeal.set(v.deal_id, new Set());
    if (v.user_id) viewersByDeal.get(v.deal_id)!.add(v.user_id);
  }
  const meetingsByDeal = new Map<string, number>();
  for (const m of allMeetings ?? []) meetingsByDeal.set(m.deal_id, (meetingsByDeal.get(m.deal_id) ?? 0) + 1);
  const commitmentsByDeal = new Map<string, number>();
  for (const c of allCommitments ?? []) commitmentsByDeal.set(c.deal_id, (commitmentsByDeal.get(c.deal_id) ?? 0) + 1);
  const notesByDeal = new Map<string, { content: string; updated_at: string }>();
  for (const n of allNotes ?? []) notesByDeal.set(n.deal_id, { content: n.content ?? '', updated_at: n.updated_at });

  const deals: DealCardData[] = rawDeals.map(({ deal, match_reason }) => {
    const id = deal.id as string;
    const storagePath = photoByDeal.get(id);
    let photo_url: string | null = null;
    if (storagePath) {
      const { data: urlData } = admin.storage.from('terminal-deal-photos').getPublicUrl(storagePath);
      photo_url = urlData?.publicUrl ?? null;
    }

    const inputs = parseDealInputs(deal);
    const computed = calculatePropertyMetrics(inputs);

    const dbCapRate = num(deal.cap_rate as string);
    const dbIrr = num(deal.irr as string);
    const dbCoc = num(deal.coc as string);
    const dbDscr = num(deal.dscr as string);
    const dbEquity = num(deal.equity_required as string);

    return {
      id,
      name: deal.name as string,
      address: (deal.address as string) ?? null,
      city: deal.city as string,
      state: deal.state as string,
      property_type: deal.property_type as string,
      purchase_price: num(deal.purchase_price as string),
      noi: num(deal.noi as string),
      cap_rate: computed.capRate > 0 ? computed.capRate : dbCapRate,
      irr: computed.irr !== null && computed.irr !== 0 ? computed.irr : dbIrr,
      coc: computed.cocReturn !== null && computed.cocReturn !== 0 ? computed.cocReturn : dbCoc,
      dscr: computed.combinedDSCR > 0 ? computed.combinedDSCR : dbDscr,
      equity_required: computed.netEquity > 0 ? computed.netEquity : dbEquity,
      occupancy: (deal.occupancy as string) ?? null,
      fully_financed: computed.netEquity <= 0,
      has_positive_cash_flow: computed.distributableCashFlow > 0,
      seller_financing: deal.seller_financing as boolean,
      note_sale: (deal.note_sale as boolean) ?? false,
      special_terms: (deal.special_terms as string) ?? null,
      dd_deadline: (deal.dd_deadline as string) ?? null,
      close_deadline: (deal.close_deadline as string) ?? null,
      status: deal.status as string,
      assigned_to: (deal.assigned_to as string) ?? null,
      quarter_release: (deal.quarter_release as string) ?? null,
      photo_url,
      viewing_count: viewersByDeal.get(id)?.size ?? 0,
      meetings_count: meetingsByDeal.get(id) ?? 0,
      square_footage: (deal.square_footage as string) ?? null,
      units: (deal.units as string) ?? null,
      class_type: (deal.class_type as string) ?? null,
      psa_draft_start: (deal.psa_draft_start as string) ?? null,
      loi_signed_at: (deal.loi_signed_at as string) ?? null,
      teaser_description: (deal.teaser_description as string) ?? null,
      commitment_count: commitmentsByDeal.get(id) ?? 0,
      note_content: notesByDeal.get(id)?.content ?? null,
      note_updated_at: notesByDeal.get(id)?.updated_at ?? null,
      deposit_amount: num(deal.deposit_amount as string),
      match_reason: match_reason ?? null,
    };
  });

  return (
    <CuratedTabClient tabId={tabId} tabName={tab.name} heroNote={tab.hero_note} deals={deals} locale={locale} />
  );
}
