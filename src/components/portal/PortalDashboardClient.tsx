'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import DealCard from '@/components/portal/DealCard';
import RePrimeLogo from '@/components/RePrimeLogo';
import ComingSoonCard from '@/components/portal/ComingSoonCard';
import MarketIntelSidebar from '@/components/portal/MarketIntelSidebar';
import { formatPrice } from '@/lib/utils/format';
import { useTranslations } from 'next-intl';
import { useDealFilters } from '@/components/portal/deal-filters/useDealFilters';
import DealFilterBar from '@/components/portal/deal-filters/DealFilterBar';

// Initial page size used until the grid's column count is measured from the DOM
// (which happens immediately after mount via ResizeObserver).
const INITIAL_COLUMNS = 4;
const INITIAL_PAGE_SIZE = INITIAL_COLUMNS * 2;

export interface DealCardData {
  id: string;
  name: string;
  address?: string | null;
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
  occupancy?: string | null;
  seller_financing: boolean;
  note_sale: boolean;
  special_terms: string | null;
  dd_deadline: string | null;
  close_deadline?: string | null;
  status: string;
  assigned_to: string | null;
  quarter_release: string | null;
  photo_url: string | null;
  viewing_count: number;
  meetings_count: number;
  square_footage?: string | null;
  units?: string | null;
  class_type?: string | null;
  // Pre-pipeline fields
  psa_draft_start?: string | null;
  loi_signed_at?: string | null;
  teaser_description?: string | null;
  is_subscribed?: boolean;
  commitment_count?: number;
  /** True when net equity ≤ 0 (fully financed deal — render ∞ / $0). */
  fully_financed?: boolean;
  /** True when distributable cash flow > 0 (only show ∞ if positive). */
  has_positive_cash_flow?: boolean;
  note_content?: string | null;
  note_updated_at?: string | null;
  /** Marketplace deals only — count of investors who have expressed interest. */
  interest_count?: number;
  /** Numeric form of terminal_deals.deposit_amount (which is stored as text like "$300,000"). */
  deposit_amount?: number;
  /** Curated group tab only — optional investor-visible reason this deal fits. */
  match_reason?: string | null;
}

interface PortalDashboardClientProps {
  deals: DealCardData[];
  locale: string;
  /**
   * When true the dashboard renders read-only (admin previewing /portal).
   * Child cards route to /admin/deals/[id]/preview instead of /portal/deals/[id]
   * and disable write toggles (watch, subscribe, commit).
   */
  previewMode?: boolean;
}

export default function PortalDashboardClient({ deals, locale, previewMode = false }: PortalDashboardClientProps) {
  const t = useTranslations('portal');

  // ── Shared search / filter / sort (same bar as Marketplace + curated tab) ──
  const { controller, filteredDeals } = useDealFilters(deals);
  const { hasActiveFilters, clearAllFilters } = controller;

  // ── Dynamic page size: two rows worth, where rows-per-row is measured from the grid ──
  const [columnsPerRow, setColumnsPerRow] = useState<number>(INITIAL_COLUMNS);
  const pageSize = Math.max(1, columnsPerRow * 2);

  // Observe the first deal grid that mounts and derive columns from the first row.
  const observedGridRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const measureColumns = useCallback((el: HTMLElement) => {
    const children = Array.from(el.children) as HTMLElement[];
    if (children.length < 1) return;
    const firstTop = children[0].offsetTop;
    const count = children.filter((c) => Math.abs(c.offsetTop - firstTop) < 2).length;
    if (count > 0) {
      setColumnsPerRow((prev) => (prev !== count ? count : prev));
    }
  }, []);

  const gridRefCallback = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    // Keep observing the first grid that mounted as long as it's still connected.
    if (observedGridRef.current && observedGridRef.current.isConnected && observedGridRef.current !== el) return;
    resizeObserverRef.current?.disconnect();
    observedGridRef.current = el;
    measureColumns(el);
    resizeObserverRef.current = new ResizeObserver(() => measureColumns(el));
    resizeObserverRef.current.observe(el);
  }, [measureColumns]);

  useEffect(() => () => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    observedGridRef.current = null;
  }, []);

  // ── Infinite scroll ──
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const { ref: sentinelRef, inView } = useInView({
    rootMargin: '0px 0px 1500px 0px',
  });

  // Reset visible count when the filtered result set changes
  useEffect(() => {
    setVisibleCount(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredDeals]);

  // When the measured column count changes, snap visibleCount up to the nearest row
  // boundary so the last row is always filled (no orphans). Never shrinks already-loaded cards.
  useEffect(() => {
    setVisibleCount((prev) => Math.max(pageSize, Math.ceil(prev / pageSize) * pageSize));
  }, [pageSize]);

  const visibleDeals = filteredDeals.slice(0, visibleCount);
  const hasMore = visibleCount < filteredDeals.length;

  // Keep loading while the sentinel stays in view. Re-runs after each load so a
  // page that doesn't push the sentinel out of the 1500px zone still advances —
  // a plain IntersectionObserver only fires on intersection-state transitions.
  useEffect(() => {
    if (inView && hasMore) {
      setVisibleCount((c) => Math.min(c + pageSize, filteredDeals.length));
    }
  }, [inView, hasMore, visibleCount, pageSize, filteredDeals.length]);

  // Drafts are only fetched on /admin/preview (investor queries filter them out),
  // but we still guard rendering with previewMode so any stray draft in investor
  // data can never leak into the public dashboard.
  const draftDeals = previewMode ? visibleDeals.filter((d) => d.status === 'draft') : [];
  const upcomingDeals = visibleDeals.filter((d) => d.status === 'coming_soon');
  const activeDeals = visibleDeals.filter((d) => d.status === 'published' || d.status === 'loi_signed');
  const assignedDeals = visibleDeals.filter((d) => d.status === 'assigned');
  const cancelledDeals = visibleDeals.filter((d) => d.status === 'cancelled');
  const closedDeals = visibleDeals.filter((d) => d.status === 'closed');

  // Hero metrics use ALL deals (not just visible) for accurate totals
  const allActiveDeals = deals.filter((d) => d.status === 'published');
  const totalDealVolume = allActiveDeals.reduce((sum, d) => sum + (d.purchase_price || 0), 0);
  const totalEquity = allActiveDeals.reduce((sum, d) => sum + (d.equity_required || 0), 0);
  const totalDeposits = allActiveDeals.reduce((sum, d) => sum + (d.deposit_amount || 0), 0);
  const avgIrr = allActiveDeals.length > 0
    ? allActiveDeals.reduce((sum, d) => sum + (d.irr || 0), 0) / allActiveDeals.length
    : 0;
  const avgCapRate = allActiveDeals.length > 0
    ? allActiveDeals.reduce((sum, d) => sum + (d.cap_rate || 0), 0) / allActiveDeals.length
    : 0;

  const quarterLabel =
    deals.find((d) => d.quarter_release)?.quarter_release ?? '';

  const summaryMetrics = [
    { label: t('totalDealVolume'), value: formatPrice(totalDealVolume) },
    { label: t('aggregateEquity'), value: formatPrice(totalEquity) },
    { label: t('totalDepositsRequired'), value: formatPrice(totalDeposits) },
    { label: t('avgProjectedIrr'), value: avgIrr > 0 ? `${avgIrr.toFixed(2)}%` : '--' },
    { label: t('avgCapRate'), value: avgCapRate > 0 ? `${avgCapRate.toFixed(2)}%` : '--' },
    { label: t('activeReleases'), value: String(allActiveDeals.length) },
  ];

  const hasAnyDeals = deals.length > 0;

  return (
    <div>
      {/* ── Full-width dark hero that bleeds edge to edge ── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #07090F 0%, #0A1628 35%, #0E3470 70%, #1A4A8A 100%)' }}>
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(188,156,69,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(188,156,69,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="max-w-[1600px] mx-auto relative px-4 pt-8 pb-5 md:px-10 md:pt-12 md:pb-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-0 mb-5 md:mb-7">
            <div>
              {quarterLabel && (
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0B8A4D] live-dot" />
                  <span className="text-[10px] font-medium tracking-[3px] uppercase text-[#D4A843]">
                    {quarterLabel} {t('release')}
                  </span>
                </div>
              )}
              <h1 className="font-[family-name:var(--font-playfair)] text-[28px] md:text-[42px] font-semibold text-white leading-[1.1] tracking-[-0.02em]">
                {t('activeOpportunities')}
              </h1>
              <p className="text-[12px] md:text-[13px] text-white/35 mt-3 font-light tracking-wide leading-relaxed">
                {t('heroDescription')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white/[0.03] border border-white/[0.06] text-white/40 px-4 md:px-5 py-2 md:py-2.5 rounded-lg text-[9px] font-medium tracking-[2px] uppercase">
                {t('confidential')}
              </span>
            </div>
          </div>

          {allActiveDeals.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[1px] rounded-xl overflow-hidden border border-white/[0.06]" data-tour="hero-metrics" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {summaryMetrics.map((m) => (
                <div key={m.label} className="px-4 md:px-5 py-5 md:py-6" style={{ background: 'rgba(14, 52, 112, 0.25)', backdropFilter: 'blur(8px)' }}>
                  <div className="text-[11px] md:text-[12px] font-semibold tracking-[1.2px] uppercase text-white/65 mb-3 whitespace-nowrap">
                    {m.label}
                  </div>
                  <div className="text-[22px] md:text-[26px] font-semibold text-white tabular-nums tracking-tight">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gradient fade from hero into page background */}
        <div className="h-20" style={{ background: 'linear-gradient(180deg, rgba(26,74,138,0) 0%, #F8F6F1 100%)' }} />
      </div>

      {/* ── Search, Filter & Sort Bar ── */}
      {hasAnyDeals && <DealFilterBar controller={controller} />}

      {/* ── Main Content ── */}
      <div className="px-4 py-6 md:px-10 md:py-10">
        {!hasAnyDeals ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center mb-5 shadow-[0_4px_20px_rgba(14,52,112,0.2)]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M3 21V7L12 3L21 7V21H15V13H9V21H3Z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinejoin="round" />
                <rect x="10" y="15" width="4" height="6" rx="0.5" fill="rgba(255,255,255,0.3)" />
                <rect x="7" y="9" width="2.5" height="2.5" rx="0.5" fill="rgba(255,255,255,0.3)" />
                <rect x="14.5" y="9" width="2.5" height="2.5" rx="0.5" fill="rgba(255,255,255,0.3)" />
              </svg>
            </div>
            <p className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-[#0E3470] mb-1.5">
              {t('noActiveOpportunities')}
            </p>
            <p className="text-sm text-[#6B7280] max-w-md text-center">
              {t('dealsReleasedSchedule')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            <div className="flex-1 min-w-0 space-y-8 md:space-y-10">
              {/* ── Drafts Section (admin preview only) ── */}
              {previewMode && draftDeals.length > 0 && (
                <div>
                  <div className="h-[2px] w-full bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />
                  <div className="mt-5 mb-5">
                    <div className="flex items-center gap-3">
                      <h2 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                        Drafts
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[1.5px] bg-[#0E3470]/10 text-[#0E3470]">
                        Admin only
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {draftDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} previewMode={previewMode} from="dashboard" />
                    ))}
                  </div>
                </div>
              )}

              {/* ── 1. Active Deals Section ── */}
              {activeDeals.length > 0 && (
                <div>
                  {(upcomingDeals.length > 0 || assignedDeals.length > 0 || cancelledDeals.length > 0 || closedDeals.length > 0) && (
                    <>

                      <div className="mt-5 mb-5">
                        <h2 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                          {t('activeDeals')}
                        </h2>
                      </div>
                    </>
                  )}
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {activeDeals.map((deal, index) => (
                      <div key={deal.id} {...(index === 0 ? { 'data-tour': 'first-deal' } : {})}>
                        <DealCard deal={deal} locale={locale} index={index} previewMode={previewMode} from="dashboard" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 2. Assigned Deals Section ── */}
              {assignedDeals.length > 0 && (
                <div>
                  <div className="h-[2px] w-full bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />
                  <div className="mt-5 mb-5">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      {t('assignedDeals')}
                    </h2>
                    <p className="text-[13px] text-[#6B7280] mt-1.5">
                      {t('assignedDealsSubtitle')}
                    </p>
                  </div>
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {assignedDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} previewMode={previewMode} from="dashboard" />
                    ))}
                  </div>
                </div>
              )}

              {/* ── 3. Coming Soon Section ── */}
              {upcomingDeals.length > 0 && (
                <div>
                  <div className="h-[2px] w-full bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />
                  <div className="mt-5 mb-5">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      {t('upcomingOpportunities')}
                    </h2>
                  </div>
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5 md:gap-6">
                    {upcomingDeals.map((deal, index) => (
                      <ComingSoonCard key={deal.id} deal={deal} index={index} previewMode={previewMode} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── 4. Closed Deals Section ── */}
              {closedDeals.length > 0 && (
                <div>
                  <div className="h-[2px] w-full bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />
                  <div className="mt-5 mb-5">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      {t('closedDeals')}
                    </h2>
                  </div>
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {closedDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} previewMode={previewMode} from="dashboard" />
                    ))}
                  </div>
                </div>
              )}

              {/* ── 5. Cancelled Deals Section ── */}
              {cancelledDeals.length > 0 && (
                <div>
                  <div className="h-[2px] w-full bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />
                  <div className="mt-5 mb-5">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      {t('cancelledDeals')}
                    </h2>
                    <p className="text-[13px] text-[#6B7280] mt-1.5">
                      {t('cancelledDealsSubtitle')}
                    </p>
                  </div>
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {cancelledDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} previewMode={previewMode} from="dashboard" />
                    ))}
                  </div>
                </div>
              )}

              {/* No results after filtering */}
              {hasActiveFilters && filteredDeals.length === 0 && (
                <div className="flex flex-col items-center py-16">
                  <div className="w-14 h-14 rounded-full bg-[#F7F8FA] flex items-center justify-center mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                  </div>
                  <p className="text-[14px] font-semibold text-[#0E3470] mb-1">{t('noMatchingDeals')}</p>
                  <p className="text-[12px] text-[#9CA3AF] mb-4">{t('tryAdjustingFilters')}</p>
                  <button onClick={clearAllFilters} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[#BC9C45] border border-[#BC9C45]/30 hover:bg-[#FDF8ED] transition-all">
                    {t('clearAll')}
                  </button>
                </div>
              )}

              {/* ── Infinite scroll sentinel ── */}
              {hasMore && <div ref={sentinelRef} className="h-1" />}
            </div>

            {/* Market Intelligence Sidebar */}
            <div className="w-full lg:w-[320px] lg:shrink-0">
              <MarketIntelSidebar />
            </div>
          </div>
        )}
      </div>

      {/* ── Confidentiality Footer ── */}
      <div className="px-4 pb-6 md:px-10 md:pb-10">
        <div className="border-t border-[#EEF0F4] pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-2">
            <RePrimeLogo width={150} variant="navy" />
            <span className="px-1.5 py-[2px] rounded bg-[#0E3470] text-[#FFFFFF] text-[8px] font-bold uppercase tracking-[1.5px] leading-none self-center">
              Beta
            </span>
          </div>
          <p className="text-[10px] text-[#9CA3AF] max-w-[600px] text-left md:text-right leading-relaxed">
            {t('footerConfidential')}
          </p>
        </div>
      </div>
    </div>
  );
}
