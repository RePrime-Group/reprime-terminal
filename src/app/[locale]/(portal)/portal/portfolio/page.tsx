import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAuthUser, getCurrentProfile } from '@/lib/supabase/currentUser';
import { formatPriceCompact, formatPercent } from '@/lib/utils/format';
import { getTranslations } from 'next-intl/server';
import PortfolioList from '@/components/portal/PortfolioList';

export const metadata = { title: 'Portfolio — RePrime Terminal Beta' };

interface Deal {
  id: string;
  name: string;
  city: string;
  state: string;
  property_type: string;
  purchase_price: string | null;
  noi: string | null;
  cap_rate: string | null;
  irr: string | null;
  coc: string | null;
  dscr: string | null;
  equity_required: string | null;
  status: string;
  assigned_to: string | null;
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('portal.portfolio');
  const supabase = await createClient();

  // Auth user and profile row are cached per-request; the layout already awaited
  // them, so these calls are free here.
  const [user, profile] = await Promise.all([getCurrentAuthUser(), getCurrentProfile()]);
  if (!user) redirect(`/${locale}/login`);

  // Only fetch the columns the UI actually renders.
  const DEAL_COLS = 'id, name, city, state, property_type, purchase_price, irr, equity_required, status';

  // Phase 1: commitment IDs + assigned deals run in parallel.
  const [commitmentsRes, assignedRes] = await Promise.all([
    supabase
      .from('terminal_deal_commitments')
      .select('deal_id')
      .eq('user_id', user.id)
      .in('status', ['pending', 'wire_sent', 'confirmed']),
    supabase
      .from('terminal_deals')
      .select(DEAL_COLS)
      .eq('assigned_to', user.id)
      .order('name', { ascending: true }),
  ]);

  const committedDealIds: string[] = commitmentsRes.data?.map((c) => c.deal_id) ?? [];
  const assignedDeals = assignedRes.data;

  // Phase 2: committed-deal details depend on commitment IDs.
  const { data: committedDeals } = committedDealIds.length > 0
    ? await supabase
        .from('terminal_deals')
        .select(DEAL_COLS)
        .in('id', committedDealIds)
        .order('name', { ascending: true })
    : { data: [] as never[] };

  // Merge and deduplicate
  const dealMap = new Map();
  (assignedDeals ?? []).forEach((d) => dealMap.set(d.id, d));
  (committedDeals ?? []).forEach((d) => { if (!dealMap.has(d.id)) dealMap.set(d.id, d); });
  const deals = Array.from(dealMap.values());

  const activeDealCount = deals.filter((d) => ['published', 'assigned', 'coming_soon', 'loi_signed'].includes(d.status)).length;

  const avgIrr =
    deals && deals.length > 0
      ? deals.reduce((sum: number, d: Deal) => sum + (parseFloat(d.irr ?? '0') || 0), 0) / deals.length
      : 0;

  const totalEquity = deals?.reduce((sum: number, d: Deal) => sum + (parseFloat(d.equity_required ?? '0') || 0), 0) ?? 0;

  const metrics = [
    {
      label: t('totalEquityCommitted'),
      value: formatPriceCompact(totalEquity),
      border: 'border-[#0A1628]',
    },
    {
      label: t('activeDeals'),
      value: String(activeDealCount),
      border: 'border-[#1E40AF]',
    },
    {
      label: t('avgProjectedIrr'),
      value: formatPercent(avgIrr),
      border: 'border-[#0B8A4D]',
    },
    {
      label: t('totalDeals'),
      value: String(deals?.length ?? 0),
      border: 'border-[#0B8A4D]',
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 md:px-10 md:py-10 space-y-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`bg-white rounded-lg p-5 border-l-[3px] ${m.border} shadow-sm`}
          >
            <p
              className="text-[9px] uppercase tracking-[0.08em] text-gray-400 font-medium"
              data-label=""
            >
              {m.label}
            </p>
            <p className="text-[22px] font-[800] text-[#0A1628] mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Heading */}
      <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-bold text-[#0A1628]">
        {t('yourInvestments')}
      </h2>

      {/* Investments List */}
      {deals && deals.length > 0 ? (
        <PortfolioList
          deals={deals.map((d: Deal) => ({
            id: d.id,
            name: d.name,
            city: d.city,
            state: d.state,
            property_type: d.property_type,
            purchase_price: d.purchase_price,
            irr: d.irr,
            status: d.status,
          }))}
          committedDealIds={committedDealIds}
          initialPhone={profile?.phone ?? ''}
          statusBadges={{
            assigned: { label: t('performing'), bg: 'bg-green-50', text: 'text-green-700' },
            renovation: { label: t('underRenovation'), bg: 'bg-amber-50', text: 'text-amber-700' },
            stabilized: { label: t('stabilized'), bg: 'bg-blue-50', text: 'text-blue-700' },
            closed: { label: t('closed'), bg: 'bg-[#0A1628]/5', text: 'text-[#0A1628]' },
          }}
          defaultBadge={{ label: t('performing'), bg: 'bg-green-50', text: 'text-green-700' }}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-6 py-12 text-center">
          <p className="text-[14px] text-gray-400">
            {t('noInvestmentsYet')}
          </p>
        </div>
      )}
    </div>
  );
}
