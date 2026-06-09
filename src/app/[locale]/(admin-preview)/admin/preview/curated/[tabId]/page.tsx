import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseDealInputs, calculatePropertyMetrics } from '@/lib/utils/deal-calculator';
import CuratedTabClient from '@/components/portal/curated/CuratedTabClient';
import CuratedPreviewPicker from '@/components/admin/investor-tabs/CuratedPreviewPicker';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

// Mirrors /[locale]/(portal)/portal/curated/[tabId] but inside the sidebar-free
// admin preview shell. Uses the service-role client so staff can preview ANY
// group's tab (no membership gate), with previewMode threaded through so writes
// are disabled and cards route to the deal preview.
export const metadata = { title: 'Group Tab Preview — RePrime Terminal Beta Admin' };

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

export default async function CuratedPreviewPage({ params }: PageProps) {
  const { locale, tabId } = await params;
  const tp = await getTranslations('admin.preview');
  const admin = createAdminClient();

  const [{ data: tab }, { data: allGroups }, { data: assignmentRows }] = await Promise.all([
    admin.from('terminal_investor_tabs').select('id, name, hero_note').eq('id', tabId).maybeSingle(),
    admin.from('terminal_investor_tabs').select('id, name').order('name', { ascending: true }),
    admin
      .from('terminal_deal_tab_assignments')
      .select(`deal_id, match_reason, display_order, deal:terminal_deals(${DEAL_FIELDS})`)
      .eq('tab_id', tabId)
      .eq('status', 'active')
      .order('display_order', { ascending: true }),
  ]);

  if (!tab) notFound();

  type Raw = Record<string, unknown>;
  const rawDeals = (assignmentRows ?? [])
    .map((a) => {
      const deal = (Array.isArray(a.deal) ? a.deal[0] : a.deal) as Raw | null;
      return deal ? { deal, match_reason: a.match_reason as string | null } : null;
    })
    .filter((x): x is { deal: Raw; match_reason: string | null } => x !== null)
    .filter((x) => x.deal.status !== 'draft');

  // Photos (service-role); preview omits live counts.
  let deals: DealCardData[] = [];
  if (rawDeals.length > 0) {
    const dealIds = rawDeals.map((x) => x.deal.id as string);
    const { data: allPhotos } = await admin
      .from('terminal_deal_photos')
      .select('deal_id, storage_path, display_order')
      .in('deal_id', dealIds)
      .order('display_order', { ascending: true });

    const photoByDeal = new Map<string, string>();
    for (const photo of allPhotos ?? []) {
      if (!photoByDeal.has(photo.deal_id)) photoByDeal.set(photo.deal_id, photo.storage_path);
    }

    deals = rawDeals.map(({ deal, match_reason }) => {
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
        viewing_count: 0,
        meetings_count: 0,
        square_footage: (deal.square_footage as string) ?? null,
        units: (deal.units as string) ?? null,
        class_type: (deal.class_type as string) ?? null,
        note_content: null,
        note_updated_at: null,
        deposit_amount: num(deal.deposit_amount as string),
        match_reason: match_reason ?? null,
      };
    });
  }

  const Banner = (
    <div className="bg-[#0E3470] border-b border-[#BC9C45]/30 text-white px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold tracking-[1.5px] uppercase text-[#BC9C45]">
          {tp('adminPreview')}
        </span>
        <span className="hidden sm:inline text-[12px] text-white/70">{tp('viewingAsInvestor')}</span>
      </div>
      <div className="flex items-center gap-3">
        {(allGroups?.length ?? 0) > 1 && (
          <CuratedPreviewPicker groups={allGroups ?? []} currentId={tab.id} locale={locale} />
        )}
        <a
          href={`/${locale}/admin/investor-tabs/${tab.id}`}
          className="px-4 py-1.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[12px] font-semibold rounded-lg transition-colors whitespace-nowrap"
        >
          {tp('backToAdmin')}
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh rp-page-texture overflow-x-hidden">
      {Banner}
      <CuratedTabClient
        tabId={tab.id}
        tabName={tab.name}
        heroNote={tab.hero_note}
        deals={deals}
        locale={locale}
        previewMode
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
