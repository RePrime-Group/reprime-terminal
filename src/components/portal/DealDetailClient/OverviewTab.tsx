'use client';

import { useTranslations } from 'next-intl';
import FadeInOnScroll from '@/components/ui/FadeInOnScroll';
import { OverviewFinancials } from '@/components/portal/FinancialOverview';
import MarketplaceInterestForm from '@/components/portal/MarketplaceInterestForm';
import { formatNumber, formatSqFt } from '@/lib/utils/format';
import { computeWALT, formatYears } from '@/lib/utils/rent-roll';
import type { DealWithDetails, TerminalTenantLease } from '@/lib/types/database';
import type { FeeDefaults } from '@/lib/utils/fee-resolver';
import { type DealInputs, calculatePropertyMetrics, calculateTraditionalClose } from '@/lib/utils/deal-calculator';
import { RealActivityFeed } from './RealActivityFeed';

interface FinancialProps {
  inputs: DealInputs;
  metrics: ReturnType<typeof calculatePropertyMetrics>;
  traditional: ReturnType<typeof calculateTraditionalClose> | null;
  isEstimated: boolean;
  feeDisclosure: FeeDefaults;
}

interface Address {
  id: string;
  label: string;
  address: string | null;
  city: string | null;
  state: string | null;
  square_footage: string | null;
  units: string | null;
  om_storage_path: string | null;
}

interface Props {
  deal: DealWithDetails;
  computed: ReturnType<typeof calculatePropertyMetrics>;
  financialProps: FinancialProps;
  addresses: Address[];
  tenants: TerminalTenantLease[];
  /** Single current occupancy % (from rent roll, falling back to the typed field). */
  occupancyPct?: number | null;
  isMarketplaceDeal: boolean;
  myMarketplaceInterest?: {
    interest_type: 'at_asking' | 'custom_price';
    target_price: number | null;
    notes: string | null;
  } | null;
  previewMode?: boolean;
  stageProgress?: Record<string, { total: number; completed: number }>;
  currentStage?: string;
  pipelineProgress?: number;
  showSocialProof: boolean;
}

export function OverviewTab({
  deal,
  computed,
  financialProps,
  addresses,
  tenants,
  occupancyPct,
  isMarketplaceDeal,
  myMarketplaceInterest,
  previewMode,
  stageProgress,
  currentStage,
  pipelineProgress,
}: Props) {
  const t = useTranslations('portal.dealDetail');
  const tc = useTranslations('portal.dealCard');
  const tPt = useTranslations('portal.propertyTypes');

  const sfNum = parseFloat((deal.square_footage ?? '').replace(/,/g, ''));

  const showSocialProof = (deal.viewing_count ?? 0) > 0 || (deal.meetings_count ?? 0) > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 lg:gap-6 mt-4 md:mt-5 px-4 md:px-8 pb-6 md:pb-8">
      {/* Left Column */}
      <div className="space-y-5">
        {deal.is_portfolio && addresses.length > 0 && (
          <FadeInOnScroll delay={0}>
            <div>
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-3">
                {t('portfolioProperties')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addresses.map((addr, i) => (
                  <div
                    key={addr.id}
                    className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow hover:border-[#BC9C45]/30 transition-all"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#0E3470]/5 flex items-center justify-center text-[18px] shrink-0">
                        🏢
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[14px] font-semibold text-[#0E3470] truncate">{addr.label}</h4>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {[addr.address, addr.city, addr.state].filter(Boolean).join(', ')}
                        </p>
                        {(addr.square_footage || addr.units) && (
                          <p className="text-[10px] text-[#9CA3AF] mt-1">
                            {addr.square_footage && `${addr.square_footage} SF`}
                            {addr.square_footage && addr.units && ' · '}
                            {addr.units && `${addr.units} Units`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeInOnScroll>
        )}

        {deal.investment_highlights && deal.investment_highlights.length > 0 && (
          <FadeInOnScroll delay={0}>
            <div>
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-3">
                {t('investmentHighlights')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {deal.investment_highlights.map((highlight, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-[#EEF0F4] rounded-xl p-4 rp-card-shadow"
                    style={{ borderLeft: '2px solid #BC9C45' }}
                  >
                    <div className="flex gap-3 items-start">
                      <div className="w-7 h-7 rounded-full bg-[#ECFDF5] flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#0B8A4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8l4 4 6-7" />
                        </svg>
                      </div>
                      <span className="text-[15px] text-[#374151] leading-relaxed">
                        {highlight}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeInOnScroll>
        )}

        {deal.acquisition_thesis && (
          <FadeInOnScroll delay={0.1}>
            <div>
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-3">
                {t('acquisitionThesis')}
              </h3>
              <p className="text-[15px] text-[#4B5563] leading-[1.7]">
                {deal.acquisition_thesis}
              </p>
            </div>
          </FadeInOnScroll>
        )}

        {computed.netEquity <= 0 && computed.distributableCashFlow > 0 && (
          <FadeInOnScroll delay={0.18}>
            <div className="bg-[#FDF8ED] border border-[#ECD9A0] rounded-xl px-5 py-4">
              <div className="text-[10px] font-bold text-[#BC9C45] uppercase tracking-[1.5px]">
                {t('annualCashFlowToInvestor')}
              </div>
              <div className="text-[26px] md:text-[30px] font-bold text-[#0B8A4D] tabular-nums leading-tight mt-1">
                ${Math.round(computed.distributableCashFlow).toLocaleString()}
              </div>
              <div className="text-[11px] text-[#6B7280] mt-1">
                {t('zeroEquityCallout')}
              </div>
            </div>
          </FadeInOnScroll>
        )}

        <FadeInOnScroll delay={0.2}>
          <OverviewFinancials {...financialProps} />
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.22}>
          <p className="text-[12px] text-[#9CA3AF] leading-relaxed px-1">
            <span className="text-[#BC9C45]">*</span> {t('betaDisclaimer')}
          </p>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.3}>
          <div>
            <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-3">
              {t('marketContext')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-3 md:p-4 rp-card-shadow min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{'👥'}</span>
                  <span className="data-label">{t('metroPopulation')}</span>
                </div>
                <div className="text-lg font-bold text-[#0E3470]">
                  {formatNumber(deal.metro_population)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-3 md:p-4 rp-card-shadow min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{'📈'}</span>
                  <span className="data-label">{t('jobGrowth')}</span>
                </div>
                <div className="text-lg font-bold text-[#0B8A4D]">
                  {deal.job_growth ? `+${deal.job_growth}` : '--'}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-3 md:p-4 rp-card-shadow min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{'🏢'}</span>
                  <span className="data-label">{t('occupancy')}</span>
                </div>
                <div className="text-lg font-bold text-[#0E3470]">
                  {occupancyPct != null ? `${occupancyPct.toFixed(1)}%` : '--'}
                </div>
              </div>
            </div>
          </div>
        </FadeInOnScroll>

        {!isMarketplaceDeal && stageProgress && currentStage && (
          <FadeInOnScroll delay={0.3}>
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 mt-3 rp-card-shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-semibold text-[#0E3470]">
                  {t('dealProgress')}
                </h3>
                <span className="text-[12px] font-semibold text-[#0B8A4D] tabular-nums">
                  {pipelineProgress !== undefined && pipelineProgress >= 0 ? `${pipelineProgress}%` : '—'}
                </span>
              </div>
              <div className="bg-[#EEF0F4] rounded-full h-2.5 overflow-hidden mb-5">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pipelineProgress !== undefined && pipelineProgress >= 0 ? pipelineProgress : 0}%`,
                    background: 'linear-gradient(90deg, #0E3470, #0B8A4D, #34D399)',
                  }}
                />
              </div>
              <div className="space-y-2.5">
                {([
                  { key: 'post_loi', label: t('postLoi'), duration: '10 Days' },
                  { key: 'due_diligence', label: t('dueDiligence'), duration: '30 Days' },
                  { key: 'pre_closing', label: t('preClosing'), duration: '30-60 Days' },
                  { key: 'post_closing', label: t('postClosing'), duration: '7 Days' },
                ] as const).map((stage) => {
                  const sp = stageProgress[stage.key] || { total: 0, completed: 0 };
                  const pct = sp.total > 0 ? Math.round((sp.completed / sp.total) * 100) : 0;
                  const isCurrent = currentStage === stage.key;
                  const isComplete = sp.total > 0 && sp.completed === sp.total;
                  const isPast = (() => {
                    const order = ['post_loi', 'due_diligence', 'pre_closing', 'post_closing'];
                    return order.indexOf(stage.key) < order.indexOf(currentStage ?? '');
                  })();

                  return (
                    <div key={stage.key} className="flex items-center gap-3">
                      {isComplete || isPast ? (
                        <div className="w-5 h-5 rounded-full bg-[#0B8A4D] flex items-center justify-center shrink-0">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      ) : isCurrent ? (
                        <div className="w-5 h-5 rounded-full border-[2.5px] border-[#0E3470] shrink-0 relative">
                          <div className="absolute inset-[3px] rounded-full bg-[#0E3470]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB] shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[11px] font-semibold ${isCurrent ? 'text-[#0E3470]' : isComplete || isPast ? 'text-[#0B8A4D]' : 'text-[#9CA3AF]'}`}>
                            {stage.label}
                          </span>
                          <span className={`text-[10px] font-semibold tabular-nums ${isCurrent ? 'text-[#0E3470]' : isComplete || isPast ? 'text-[#0B8A4D]' : 'text-[#9CA3AF]'}`}>
                            {sp.total > 0 ? `${sp.completed}/${sp.total}` : '—'}
                          </span>
                        </div>
                        <div className="bg-[#EEF0F4] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: isComplete || isPast ? '#0B8A4D' : isCurrent ? '#0E3470' : '#D1D5DB',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </FadeInOnScroll>
        )}
      </div>

      {/* Right Column (Sidebar) */}
      <div className="space-y-3">
        {isMarketplaceDeal && !previewMode && (
          <MarketplaceInterestForm
            dealId={deal.id}
            askingPrice={deal.purchase_price}
            initialInterest={myMarketplaceInterest ?? null}
          />
        )}

        <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
          <h3 className="text-[15px] font-semibold text-[#0E3470] mb-3">
            {t('propertyDetails')}
          </h3>
          <div className="space-y-0">
            {(() => {
              // Hydrate SF/units from the buildings when the deal-level field is
              // empty (portfolios store these per building) so the panel matches
              // the rest of the page instead of rendering blank (6.10).
              const sumAddrSf = addresses.reduce((s, a) => s + (parseFloat(String(a.square_footage ?? '').replace(/[^0-9.]/g, '')) || 0), 0);
              const totalSf = Number.isFinite(sfNum) && sfNum > 0 ? sfNum : sumAddrSf;
              const sumAddrUnits = addresses.reduce((s, a) => s + (parseInt(String(a.units ?? '').replace(/[^0-9]/g, ''), 10) || 0), 0);
              const dealUnitsNum = parseInt(String(deal.units ?? '').replace(/[^0-9]/g, ''), 10);
              const totalUnits = Number.isFinite(dealUnitsNum) && dealUnitsNum > 0 ? dealUnitsNum : sumAddrUnits;

              const ppNum = parseFloat(deal.purchase_price ?? '0');
              const pricePerSf = ppNum > 0 && totalSf > 0
                ? `$${(ppNum / totalSf).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : null;

              const rows: { key: string; label: string; value: string | null | undefined }[] = [];
              if (deal.address) {
                rows.push({ key: 'address', label: t('address'), value: deal.address });
              }
              rows.push(
                { key: 'type', label: t('type'), value: tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type },
                { key: 'class', label: t('class'), value: deal.class_type },
                { key: 'yearBuilt', label: t('yearBuilt'), value: deal.year_built?.toString() },
              );
              if (deal.year_renovated) {
                rows.push({ key: 'yearRenovated', label: t('yearRenovated'), value: deal.year_renovated });
              }
              rows.push(
                { key: 'sqFt', label: t('sqFt'), value: totalSf > 0 ? formatSqFt(totalSf) : null },
                { key: 'units', label: t('units'), value: totalUnits > 0 ? totalUnits.toLocaleString() : deal.units },
              );
              if (tenants.length > 0) {
                const wVal = computeWALT(tenants);
                if (wVal !== null) {
                  rows.push({ key: 'walt', label: 'WALT', value: formatYears(wVal) });
                }
              }
              if (occupancyPct != null) {
                rows.push({ key: 'occupancy', label: 'Occupancy', value: `${occupancyPct.toFixed(1)}%` });
              }
              rows.push({ key: 'neighborhood', label: t('neighborhood'), value: deal.neighborhood });
              if (pricePerSf) {
                rows.push({ key: 'pricePerSf', label: t('pricePerSf'), value: pricePerSf });
              }
              return rows.map((row, idx) => (
                <div
                  key={row.key}
                  className={`flex justify-between gap-3 py-2 ${idx % 2 === 0 ? 'bg-[#F7F8FA]' : ''} px-2 rounded`}
                >
                  <span className="data-label shrink-0">{row.label}</span>
                  <span className="text-[14px] font-semibold text-[#0E3470] text-right break-words min-w-0">
                    {row.value ?? '--'}
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>

        {(() => {
          const askingCap = parseFloat(deal.asking_cap_rate ?? '');
          if (!(askingCap > 0)) return null;
          const negotiatedCap = computed.capRate;
          const areaCap = parseFloat(deal.area_cap_rate ?? '');
          const hasArea = areaCap > 0;

          const vsAskBps = Math.round((negotiatedCap - askingCap) * 100);
          const vsMarketBps = hasArea ? Math.round((negotiatedCap - areaCap) * 100) : null;

          const fmtBps = (bps: number) => {
            const sign = bps >= 0 ? '+' : '';
            return `${sign}${bps} ${t('bps')}`;
          };
          const arrow = (bps: number) => (bps >= 0 ? '▲' : '▼');
          const tone = (bps: number) =>
            bps >= 0 ? { color: '#0B8A4D', bg: 'rgba(11,138,77,0.08)' } : { color: '#C0392B', bg: 'rgba(192,57,43,0.08)' };

          return (
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
              <h3 className="text-[15px] font-semibold text-[#0E3470] mb-3 flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-[2px] uppercase text-[#BC9C45]">★</span>
                {t('negotiationSummary')}
              </h3>
              <div className="space-y-1.5 mb-4">
                {hasArea && (
                  <div className="flex justify-between items-center gap-3 py-2 px-2 bg-[#F7F8FA] rounded">
                    <div className="flex flex-col min-w-0">
                      <span className="data-label">{t('areaCapRate')}</span>
                      <span className="text-[11px] font-medium text-[#6B7280] mt-0.5">{t('areaCapRateSource')}</span>
                    </div>
                    <span className="text-sm font-semibold text-[#0E3470] tabular-nums shrink-0">{areaCap.toFixed(2)}%</span>
                  </div>
                )}
                <div className="flex justify-between items-center gap-3 py-2 px-2 rounded">
                  <div className="flex flex-col min-w-0">
                    <span className="data-label">{t('askingCapRate')}</span>
                    <span className="text-[11px] font-medium text-[#6B7280] mt-0.5">{t('askingCapRateSource')}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#0E3470] tabular-nums shrink-0">{askingCap.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center py-2 px-2 bg-[#FDF8ED] rounded border-l-[3px] border-[#BC9C45]">
                  <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[#BC9C45]">{t('negotiatedCapRate')}</span>
                  <span className="text-base font-bold text-[#0E3470] tabular-nums">{negotiatedCap.toFixed(2)}%</span>
                </div>
              </div>
              <div className="space-y-2">
                {(() => {
                  const t1 = tone(vsAskBps);
                  return (
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: t1.bg }}>
                      <span className="data-label">{t('vsSellerAsk')}</span>
                      <span className="text-base font-bold tabular-nums flex items-center gap-1" style={{ color: t1.color }}>
                        <span>{arrow(vsAskBps)}</span>
                        {fmtBps(vsAskBps)}
                      </span>
                    </div>
                  );
                })()}
                {vsMarketBps !== null && (() => {
                  const t2 = tone(vsMarketBps);
                  return (
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: t2.bg }}>
                      <span className="data-label">{t('vsMarket')}</span>
                      <span className="text-base font-bold tabular-nums flex items-center gap-1" style={{ color: t2.color }}>
                        <span>{arrow(vsMarketBps)}</span>
                        {fmtBps(vsMarketBps)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}

        <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
          <h4 className="text-[15px] font-semibold text-[#0E3470] mb-3">
            {t('capRateTrend')}
          </h4>
          <svg viewBox="0 0 200 60" className="w-full h-14">
            <defs>
              <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0B8A4D" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#0B8A4D" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points="0,45 30,40 60,38 90,35 120,30 150,28 180,25 200,22 200,60 0,60" fill="url(#sparkFill)" />
            <polyline points="0,45 30,40 60,38 90,35 120,30 150,28 180,25 200,22" stroke="#0B8A4D" strokeWidth="2" fill="none" />
            <circle cx="200" cy="22" r="4" fill="#0B8A4D" />
            <circle cx="200" cy="22" r="7" fill="#0B8A4D" fillOpacity="0.15" />
          </svg>
        </div>

        <RealActivityFeed dealId={deal.id} />

        {showSocialProof && (
          <div className="bg-[#FEF2F2] rounded-xl p-4 border border-[#FECACA]">
            <div className="text-center">
              <div className="text-[32px] font-[800] text-[#DC2626]">{deal.viewing_count}</div>
              <div className="text-xs text-[#6B7280] mb-2">{t('investorsReviewing')}</div>
              <div className="text-[32px] font-[800] text-[#DC2626]">{deal.meetings_count}</div>
              <div className="text-xs text-[#6B7280]">{t('meetingsScheduled')}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
