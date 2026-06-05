'use client';

import { type RefObject } from 'react';
import type React from 'react';
import { useTranslations } from 'next-intl';
import FadeInOnScroll from '@/components/ui/FadeInOnScroll';
import { formatPrice, formatPercent, formatDSCR } from '@/lib/utils/format';
import type { DealWithDetails } from '@/lib/types/database';
import { calculatePropertyMetrics } from '@/lib/utils/deal-calculator';
import { ImageCarousel } from './ImageCarousel';
import { CountdownRing } from './CountdownRing';
import { MetricCard, buildIrrAssumptions } from './MetricCard';

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
  photoUrls: string[];
  computed: ReturnType<typeof calculatePropertyMetrics>;
  /** Fee-adjusted net IRR/CoC (after all fees + carry) for the headline return tiles.
   *  When provided, these replace the property-level (gross) figures — see 6.1 fix. */
  netIrr?: number | null;
  netCoc?: number | null;
  /** Single current occupancy % (from rent roll, falling back to the typed field). */
  occupancyPct?: number | null;
  addresses: Address[];
  omMenuRef: RefObject<HTMLDivElement | null>;
  omMenuOpen: boolean;
  setOmMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  thesisRef: RefObject<HTMLParagraphElement | null>;
  thesisExpanded: boolean;
  thesisOverflows: boolean;
  setThesisExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  handleViewDocument: (url: string, name: string, storagePath?: string) => void;
}

export function HeroSection({
  deal,
  photoUrls,
  computed,
  netIrr,
  netCoc,
  occupancyPct,
  addresses,
  omMenuRef,
  omMenuOpen,
  setOmMenuOpen,
  thesisRef,
  thesisExpanded,
  thesisOverflows,
  setThesisExpanded,
  handleViewDocument,
}: Props) {
  const t = useTranslations('portal.dealDetail');
  const tc = useTranslations('portal.dealCard');

  const fullyFinanced = computed.netEquity <= 0;
  const hasPositiveCF = computed.distributableCashFlow > 0;
  const infReturn = fullyFinanced ? (hasPositiveCF ? '∞' : 'N/A') : null;
  const irrNote = fullyFinanced ? undefined : buildIrrAssumptions(deal, computed);
  // Headline returns use the fee-adjusted net figures (after all fees + carry) when
  // the parent provides them; fall back to property-level only if not passed.
  const headlineIrr = netIrr !== undefined ? netIrr : computed.irr;
  const headlineCoc = netCoc !== undefined ? netCoc : computed.cocReturn;

  const metrics = [
    { label: tc('purchasePrice'), value: formatPrice(deal.purchase_price), borderColor: '#0E3470', span: 'col-span-2', size: 'headline' },
    { label: tc('equityRequired'), value: fullyFinanced ? '$0' : (computed.netEquity > 0 ? '$' + Math.round(computed.netEquity).toLocaleString() : formatPrice(deal.equity_required)), borderColor: '#BC9C45', valueColor: fullyFinanced ? '#0B8A4D' : undefined, span: 'col-span-2', size: 'headline' },
    { label: tc('noi'), value: formatPrice(deal.noi), borderColor: '#0E3470', span: 'col-span-1' },
    { label: t('occupancy'), value: occupancyPct != null ? `${occupancyPct.toFixed(1)}%` : '—', borderColor: '#0E3470', span: 'col-span-1' },
    { label: tc('capRate'), value: computed.capRate > 0 ? computed.capRate.toFixed(2) + '%' : formatPercent(deal.cap_rate), borderColor: '#BC9C45', span: 'col-span-1' },
    { label: tc('irr'), value: infReturn ?? (headlineIrr !== null ? headlineIrr.toFixed(2) + '%' : tc('pending')), borderColor: '#0B8A4D', valueColor: '#0B8A4D', span: 'col-span-1', note: irrNote },
    { label: tc('coc'), value: infReturn ?? (headlineCoc !== null ? headlineCoc.toFixed(2) + '%' : tc('pending')), borderColor: '#0B8A4D', valueColor: '#0B8A4D', span: 'col-span-1' },
    { label: tc('dscr'), value: computed.combinedDSCR > 0 ? computed.combinedDSCR.toFixed(2) + 'x' : formatDSCR(deal.dscr), borderColor: '#0E3470', span: 'col-span-1' },
  ] as { label: string; value: string; borderColor: string; valueColor?: string; span: string; note?: string; size?: 'headline' | 'normal' }[];

  const portfolioAddrOms = deal.is_portfolio
    ? (addresses ?? []).filter((a) => a.om_storage_path)
    : [];

  return (
    <div className="flex items-center gap-3 lg:gap-4 p-4 md:p-8">
      <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4 md:gap-6 items-stretch">
        {/* Left: Image Carousel + Countdown Rings */}
        <div className="flex flex-col gap-4 h-full">
          <ImageCarousel urls={photoUrls} />
          <div className="mt-auto bg-white rounded-2xl border border-[#EEF0F4] p-4 md:p-6 rp-card-shadow">
            <div className="flex items-center justify-around gap-2 flex-wrap sm:flex-nowrap">
              <CountdownRing label={t('dueDiligence')} targetDate={deal.dd_deadline} accentColor="#BC9C45" />
              <CountdownRing label={t('closing')} targetDate={deal.close_deadline} accentColor="#0E3470" />
              <CountdownRing label={t('extension')} targetDate={deal.extension_deadline} accentColor="#1D5FB8" />
            </div>
            {deal.timeline_note && (
              <div className="mt-4 px-4 py-3 bg-[#FDF8ED] border-l-[3px] border-[#BC9C45] rounded-md text-[13px] text-[#6B7280] leading-[1.6]">
                <span className="font-bold text-[#BC9C45] mr-2 tracking-[1px]">
                  ℹ {t('timelineNoteLabel')}
                </span>
                {deal.timeline_note}
              </div>
            )}
          </div>
        </div>

        {/* Right: Metric Cards + Terminal Intelligence + Transaction Documents */}
        <div className="flex flex-col gap-3 justify-between">
          <div className="grid grid-cols-2 gap-2 md:gap-2.5">
            {metrics.map((m, idx) => (
              <FadeInOnScroll key={m.label} delay={idx * 0.05} className={m.span}>
                <MetricCard
                  label={m.label}
                  value={m.value}
                  borderColor={m.borderColor}
                  valueColor={m.valueColor}
                  note={m.note}
                  size={m.size}
                />
              </FadeInOnScroll>
            ))}
          </div>

          {/* Terminal Intelligence Panel */}
          <div className="bg-white rounded-xl overflow-hidden border border-[#EEF0F4] rp-card-shadow">
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#FAF3DD] flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#BC9C45" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[2.5px] text-[#BC9C45]">
                    {t('terminalIntelligence')}
                  </div>
                  <div className="text-[10px] text-[#9CA3AF] mt-0.5">
                    {t('institutionalAnalysis')}
                  </div>
                </div>
              </div>
              <p
                ref={thesisRef}
                className={`text-[13px] text-[#4B5563] leading-[1.7] ${thesisExpanded ? '' : 'line-clamp-4'}`}
              >
                {deal.acquisition_thesis ? deal.acquisition_thesis : ''}
              </p>
              {(thesisOverflows || thesisExpanded) && (
                <button
                  type="button"
                  onClick={() => setThesisExpanded((v) => !v)}
                  className="mt-2 text-[11px] font-semibold text-[#BC9C45] hover:text-[#A88A3D] transition-colors"
                >
                  {thesisExpanded ? t('hide') : t('readMore')}
                </button>
              )}
              <div className="flex items-center justify-evenly gap-3 mt-4 flex-wrap">
                {deal.full_report_storage_path ? (
                  <button
                    onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/full-report?view=true`, `${deal.name} — ${t('fullReport')}`)}
                    className="px-3 py-1.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[11px] font-semibold rounded-lg transition-colors"
                  >
                    {t('fullReport')}
                  </button>
                ) : (
                  <span className="px-4 py-2 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default">
                    {t('fullReport')}
                  </span>
                )}
                {deal.costar_report_storage_path ? (
                  <button
                    onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/costar-report?view=true`, `${deal.name} — ${t('costarReport')}`)}
                    className="px-4 py-2 bg-[#0E3470] hover:bg-[#0A2656] text-white text-[11px] font-semibold rounded-lg transition-colors"
                  >
                    {t('costarReport')}
                  </button>
                ) : (
                  <span className="px-4 py-2 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default">
                    {t('costarReport')}
                  </span>
                )}
                {deal.tenants_report_storage_path ? (
                  <button
                    onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/tenants-report?view=true`, `${deal.name} — ${t('tenantsReport')}`)}
                    className="px-4 py-2 bg-[#0F766E] hover:bg-[#0C5E5B] text-white text-[11px] font-semibold rounded-lg transition-colors"
                  >
                    {t('tenantsReport')}
                  </button>
                ) : (
                  <span className="px-4 py-2 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default">
                    {t('tenantsReport')}
                  </span>
                )}
                {deal.lease_summary_storage_path ? (
                  <button
                    onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/lease-summary?view=true`, `${deal.name} — ${t('leaseSummary')}`)}
                    className="px-4 py-2 bg-[#D97706] hover:bg-[#B45309] text-white text-[11px] font-semibold rounded-lg transition-colors"
                  >
                    {t('leaseSummary')}
                  </button>
                ) : (
                  <span className="px-4 py-2 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default">
                    {t('leaseSummary')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Documents */}
          <div className="bg-white rounded-xl p-5 border border-[#EEF0F4] rp-card-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#0E3470]/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div>
                <div className="text-[12px] font-[700] uppercase tracking-[2px] text-[#0E3470]">
                  {t('transactionDocuments')}
                </div>
                <div className="text-[9px] text-[#9CA3AF]">
                  {t('transactionDocumentsSubtitle')}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {portfolioAddrOms.length > 0 ? (
                <div ref={omMenuRef} className="relative">
                  <button
                    onClick={() => setOmMenuOpen((o) => !o)}
                    className="w-full px-3 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[11px] font-semibold rounded-lg transition-colors text-center flex items-center justify-center gap-1.5"
                  >
                    {t('viewOm')}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${omMenuOpen ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {omMenuOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#EEF0F4] rounded-lg shadow-lg z-10 overflow-hidden">
                      {portfolioAddrOms.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => {
                            setOmMenuOpen(false);
                            handleViewDocument(`/api/deals/${deal.id}/om?addressId=${a.id}&view=true`, `${a.label} — ${t('offeringMemorandum')}`);
                          }}
                          className="w-full px-3 py-2.5 text-left text-[11px] font-medium text-[#0E3470] hover:bg-[#FDF8ED] transition-colors border-b border-[#EEF0F4] last:border-b-0"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : deal.om_storage_path ? (
                <button
                  onClick={() => handleViewDocument(`/api/deals/${deal.id}/om?view=true`, `${deal.name} — ${t('offeringMemorandum')}`)}
                  className="px-3 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[11px] font-semibold rounded-lg transition-colors text-center"
                >
                  {t('viewOm')}
                </button>
              ) : (
                <span className="px-3 py-2.5 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default text-center">
                  {t('omPending')}
                </span>
              )}
              {deal.loi_signed_storage_path ? (
                <button
                  onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/loi?view=true`, `${deal.name} — ${t('signedLoi')}`)}
                  className="px-3 py-2.5 border border-[#EEF0F4] hover:border-[#BC9C45] text-[#0E3470] text-[11px] font-semibold rounded-lg transition-colors text-center"
                >
                  {t('viewSignedLoi')}
                </button>
              ) : (
                <span className="px-3 py-2.5 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default text-center">
                  {t('signedLoiPending')}
                </span>
              )}
              {deal.psa_storage_path ? (
                <button
                  onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/psa?view=true`, `${deal.name} — ${t('psa')}`)}
                  className="px-3 py-2.5 border border-[#EEF0F4] hover:border-[#BC9C45] text-[#0E3470] text-[11px] font-semibold rounded-lg transition-colors text-center"
                >
                  {t('viewPsa')}
                </button>
              ) : (
                <span className="px-3 py-2.5 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default text-center">
                  {t('psaPending')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
