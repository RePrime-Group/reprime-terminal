import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentAuthUser } from '@/lib/supabase/currentUser';
import { parseDealInputs, calculatePropertyMetrics } from '@/lib/utils/deal-calculator';
import DealCard from '@/components/portal/DealCard';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

export const metadata = { title: 'Marketplace — RePrime Terminal Beta' };

function num(val: string | number | null | undefined): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.replace(/[$,%\s]/g, '')) || 0;
}

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('portal.marketplace');
  const supabase = await createClient();
  const user = await getCurrentAuthUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('id, name, address, city, state, property_type, purchase_price, noi, cap_rate, irr, coc, dscr, equity_required, occupancy, seller_financing, note_sale, special_terms, dd_deadline, close_deadline, status, assigned_to, quarter_release, square_footage, units, class_type, ltv, interest_rate, amortization_years, loan_fee_points, io_period_months, mezz_percent, mezz_rate, mezz_term_months, seller_credit, assignment_fee, acq_fee, asset_mgmt_fee, gp_carry, pref_return, hold_period_years, exit_cap_rate, rent_growth, legal_title_estimate, disposition_cost_pct, capex, area_cap_rate, asking_cap_rate')
    .eq('status', 'marketplace')
    .order('created_at', { ascending: false });

  if (!deals || deals.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-6 md:px-10 md:py-10">
        <header className="mb-8">
          <h1 className="font-[family-name:var(--font-playfair)] text-[28px] font-bold text-[#0A1628]">
            {t('title')}
          </h1>
          <p className="text-[14px] text-gray-500 mt-1.5">{t('subtitle')}</p>
        </header>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-6 py-12 text-center">
          <p className="text-[14px] text-gray-400">{t('noDealsYet')}</p>
        </div>
      </div>
    );
  }

  const dealIds = deals.map((d) => d.id);
  const admin = createAdminClient();

  // Photos + per-user notes via the user-auth client (RLS allowed by phase A
  // policies). Interest counts run via the admin client because RLS hides
  // other users' interest rows from investors — admins can aggregate safely.
  const [
    { data: photos },
    { data: notes },
    { data: interestRows },
  ] = await Promise.all([
    admin
      .from('terminal_deal_photos')
      .select('deal_id, storage_path, display_order')
      .in('deal_id', dealIds)
      .order('display_order', { ascending: true }),
    supabase
      .from('user_deal_notes')
      .select('deal_id, content, updated_at')
      .eq('user_id', user.id)
      .in('deal_id', dealIds),
    admin
      .from('marketplace_interest')
      .select('deal_id')
      .in('deal_id', dealIds),
  ]);

  const photoByDeal = new Map<string, string>();
  for (const p of photos ?? []) {
    if (!photoByDeal.has(p.deal_id)) photoByDeal.set(p.deal_id, p.storage_path);
  }
  const notesByDeal = new Map<string, { content: string; updated_at: string }>();
  for (const n of notes ?? []) {
    notesByDeal.set(n.deal_id, { content: n.content ?? '', updated_at: n.updated_at });
  }
  const interestByDeal = new Map<string, number>();
  for (const r of interestRows ?? []) {
    interestByDeal.set(r.deal_id, (interestByDeal.get(r.deal_id) ?? 0) + 1);
  }

  const enriched: DealCardData[] = deals.map((deal) => {
    const inputs = parseDealInputs(deal as unknown as Record<string, unknown>);
    const computed = calculatePropertyMetrics(inputs);

    const storagePath = photoByDeal.get(deal.id);
    let photo_url: string | null = null;
    if (storagePath) {
      const { data: urlData } = admin.storage.from('terminal-deal-photos').getPublicUrl(storagePath);
      photo_url = urlData?.publicUrl ?? null;
    }

    const dbCapRate = num(deal.cap_rate);
    const dbIrr = num(deal.irr);
    const dbCoc = num(deal.coc);
    const dbDscr = num(deal.dscr);
    const dbEquity = num(deal.equity_required);

    return {
      id: deal.id,
      name: deal.name,
      address: deal.address ?? null,
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
      occupancy: deal.occupancy ?? null,
      fully_financed: computed.netEquity <= 0,
      has_positive_cash_flow: computed.distributableCashFlow > 0,
      seller_financing: deal.seller_financing,
      note_sale: deal.note_sale ?? false,
      special_terms: deal.special_terms,
      dd_deadline: deal.dd_deadline,
      close_deadline: deal.close_deadline ?? null,
      status: deal.status,
      assigned_to: deal.assigned_to,
      quarter_release: deal.quarter_release,
      photo_url,
      viewing_count: 0,
      meetings_count: 0,
      square_footage: deal.square_footage,
      units: deal.units,
      class_type: deal.class_type,
      note_content: notesByDeal.get(deal.id)?.content ?? null,
      note_updated_at: notesByDeal.get(deal.id)?.updated_at ?? null,
      interest_count: interestByDeal.get(deal.id) ?? 0,
    };
  });

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 md:px-10 md:py-10">
      <header className="mb-8">
        <h1 className="font-[family-name:var(--font-playfair)] text-[28px] font-bold text-[#0A1628]">
          {t('title')}
        </h1>
        <p className="text-[14px] text-gray-500 mt-1.5">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {enriched.map((deal, i) => (
          <DealCard key={deal.id} deal={deal} locale={locale} index={i} />
        ))}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
