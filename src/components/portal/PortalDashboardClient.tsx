'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DealCard from '@/components/portal/DealCard';
import ComingSoonCard from '@/components/portal/ComingSoonCard';
import MarketIntelSidebar from '@/components/portal/MarketIntelSidebar';
import { formatPrice, formatPriceCompact } from '@/lib/utils/format';
import { useTranslations } from 'next-intl';

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

type SortKey = 'name' | 'purchase_price' | 'cap_rate' | 'irr' | 'coc' | 'equity_required' | 'noi';
type SortDir = 'asc' | 'desc';

export default function PortalDashboardClient({ deals, locale, previewMode = false }: PortalDashboardClientProps) {
  const t = useTranslations('portal');
  const tPt = useTranslations('portal.propertyTypes');

  // ── Search, Filter & Sort state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [sellerFinancingOnly, setSellerFinancingOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [irrMin, setIrrMin] = useState<number>(0);
  const [cocMin, setCocMin] = useState<number>(0);
  const [sortKey, setSortKey] = useState<SortKey | ''>('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Derive unique property types and price bounds from data
  const propertyTypes = useMemo(() => [...new Set(deals.map((d) => d.property_type).filter(Boolean))].sort(), [deals]);
  const priceBounds = useMemo(() => {
    const prices = deals.map((d) => d.purchase_price).filter(Boolean);
    return [Math.min(...prices, 0), Math.max(...prices, 1)] as [number, number];
  }, [deals]);

  // Initialize price range once
  useEffect(() => {
    setPriceRange(priceBounds);
  }, [priceBounds]);

  const hasActiveFilters = searchQuery !== '' || selectedTypes.size > 0 || sellerFinancingOnly || priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1] || irrMin > 0 || cocMin > 0;

  function clearAllFilters() {
    setSearchQuery('');
    setSelectedTypes(new Set());
    setSellerFinancingOnly(false);
    setPriceRange(priceBounds);
    setIrrMin(0);
    setCocMin(0);
    setSortKey('');
    setSortDir('desc');
  }

  // ── Filter + Sort pipeline ──
  const filteredDeals = useMemo(() => {
    let result = deals;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) =>
        d.name.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q) ||
        d.state.toLowerCase().includes(q) ||
        `${d.city} ${d.state}`.toLowerCase().includes(q)
      );
    }

    // Property type
    if (selectedTypes.size > 0) {
      result = result.filter((d) => selectedTypes.has(d.property_type));
    }

    // Seller financing
    if (sellerFinancingOnly) {
      result = result.filter((d) => d.seller_financing);
    }

    // Price range
    if (priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1]) {
      result = result.filter((d) => d.purchase_price >= priceRange[0] && d.purchase_price <= priceRange[1]);
    }

    // IRR minimum
    if (irrMin > 0) {
      result = result.filter((d) => d.irr >= irrMin);
    }

    // CoC minimum
    if (cocMin > 0) {
      result = result.filter((d) => d.coc >= cocMin);
    }

    // Sort
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortKey] ?? 0;
        const bVal = b[sortKey] ?? 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      });
    }

    return result;
  }, [deals, searchQuery, selectedTypes, sellerFinancingOnly, priceRange, priceBounds, irrMin, cocMin, sortKey, sortDir]);

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
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedTypes, sellerFinancingOnly, priceRange, irrMin, cocMin, sortKey, sortDir]);

  // When the measured column count changes, snap visibleCount up to the nearest row
  // boundary so the last row is always filled (no orphans). Never shrinks already-loaded cards.
  useEffect(() => {
    setVisibleCount((prev) => Math.max(pageSize, Math.ceil(prev / pageSize) * pageSize));
  }, [pageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + pageSize, filteredDeals.length));
  }, [pageSize, filteredDeals.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    // Pre-fetch the next page well before the user reaches the bottom so cards
    // render as they scroll, not after they hit the footer.
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '0px 0px 1500px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const visibleDeals = filteredDeals.slice(0, visibleCount);
  const hasMore = visibleCount < filteredDeals.length;

  // Drafts are only fetched on /admin/preview (investor queries filter them out),
  // but we still guard rendering with previewMode so any stray draft in investor
  // data can never leak into the public dashboard.
  const draftDeals = previewMode ? visibleDeals.filter((d) => d.status === 'draft') : [];
  const upcomingDeals = visibleDeals.filter((d) => d.status === 'coming_soon');
  const activeDeals = visibleDeals.filter((d) => d.status === 'published' || d.status === 'loi_signed');
  const assignedDeals = visibleDeals.filter((d) => d.status === 'assigned');
  const cancelledDeals = visibleDeals.filter((d) => d.status === 'cancelled');
  const closedDeals = visibleDeals.filter((d) => d.status === 'closed');
  const activeCount = activeDeals.length;
  const closedCount = closedDeals.length;

  // Hero metrics use ALL deals (not just visible) for accurate totals
  const allActiveDeals = deals.filter((d) => d.status === 'published');
  const totalDealVolume = allActiveDeals.reduce((sum, d) => sum + (d.purchase_price || 0), 0);
  const totalEquity = allActiveDeals.reduce((sum, d) => sum + (d.equity_required || 0), 0);
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-[1px] rounded-xl overflow-hidden border border-white/[0.06]" data-tour="hero-metrics" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {summaryMetrics.map((m) => (
                <div key={m.label} className="px-4 md:px-5 py-4 md:py-5" style={{ background: 'rgba(14, 52, 112, 0.25)', backdropFilter: 'blur(8px)' }}>
                  <div className="text-[9px] font-semibold tracking-[2px] uppercase text-white/30 mb-2">
                    {m.label}
                  </div>
                  <div className="text-[18px] md:text-[22px] font-semibold text-white tabular-nums tracking-tight">
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
      {hasAnyDeals && (
        <div className="px-4 md:px-10 -mt-14 mb-0 relative z-10">
          <div className="max-w-[1600px] mx-auto">
            {/* Main bar */}
            <div className="bg-white rounded-xl border border-[#EEF0F4] rp-card-shadow px-4 md:px-5 py-3.5 flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative w-full md:flex-1 md:w-auto md:max-w-[340px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchDealsPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 text-[13px] text-[#0E3470] bg-[#F7F8FA] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45]/40 placeholder:text-[#6B7280] transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#0E3470] transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px h-7 bg-[#EEF0F4]" />

              {/* Property type pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {propertyTypes.map((pt) => {
                  const active = selectedTypes.has(pt);
                  return (
                    <button
                      key={pt}
                      onClick={() => {
                        const next = new Set(selectedTypes);
                        active ? next.delete(pt) : next.add(pt);
                        setSelectedTypes(next);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                        active
                          ? 'bg-[#0E3470] text-white border-[#0E3470]'
                          : 'bg-[#F7F8FA] text-[#6B7280] border-[#D1D5DB] hover:border-[#BC9C45]/40 hover:text-[#0E3470]'
                      }`}
                    >
                      {tPt.has(pt) ? tPt(pt) : pt}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="hidden md:block w-px h-7 bg-[#EEF0F4]" />

              {/* Filters toggle */}
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all border ${
                  filtersOpen || hasActiveFilters
                    ? 'bg-[#FDF8ED] text-[#BC9C45] border-[#BC9C45]/30'
                    : 'bg-[#F7F8FA] text-[#6B7280] border-[#D1D5DB] hover:border-[#BC9C45]/30'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                {t('filters')}
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#BC9C45]" />
                )}
              </button>

              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={sortKey ? `${sortKey}_${sortDir}` : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) { setSortKey(''); return; }
                    const lastUnderscore = val.lastIndexOf('_');
                    const key = val.slice(0, lastUnderscore) as SortKey;
                    const dir = val.slice(lastUnderscore + 1) as SortDir;
                    setSortKey(key);
                    setSortDir(dir);
                  }}
                  className="appearance-none pl-3 pr-7 py-2 rounded-lg text-[11px] font-semibold bg-[#F7F8FA] text-[#6B7280] border border-[#D1D5DB] hover:border-[#BC9C45]/30 focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 cursor-pointer transition-all"
                >
                  <option value="">{t('sortBy')}</option>
                  <option value="name_asc">{t('sortNameAZ')}</option>
                  <option value="name_desc">{t('sortNameZA')}</option>
                  <option value="purchase_price_desc">{t('sortPriceHigh')}</option>
                  <option value="purchase_price_asc">{t('sortPriceLow')}</option>
                  <option value="cap_rate_desc">{t('sortCapRateHigh')}</option>
                  <option value="cap_rate_asc">{t('sortCapRateLow')}</option>
                  <option value="irr_desc">{t('sortIRRHigh')}</option>
                  <option value="irr_asc">{t('sortIRRLow')}</option>
                  <option value="coc_desc">{t('sortCoCHigh')}</option>
                  <option value="coc_asc">{t('sortCoCLow')}</option>
                  <option value="equity_required_desc">{t('sortEquityHigh')}</option>
                  <option value="equity_required_asc">{t('sortEquityLow')}</option>
                </select>
                <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
              </div>

              {/* Clear all */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-[11px] font-semibold text-[#DC2626]/70 hover:text-[#DC2626] transition-colors whitespace-nowrap"
                >
                  {t('clearAll')}
                </button>
              )}
            </div>

            {/* Expandable filter panel */}
            {filtersOpen && (
              <div className="mt-2 bg-white rounded-xl border border-[#EEF0F4] shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-4 md:px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {/* Price range */}
                <div>
                  <label className="text-[10px] font-bold text-[#0E3470] uppercase tracking-[1.5px] mb-3 block">{t('priceRange')}</label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <span className="text-[9px] text-[#9CA3AF] mb-1 block">{t('min')}</span>
                      <input
                        type="number"
                        value={priceRange[0] || ''}
                        onChange={(e) => setPriceRange([Number(e.target.value) || 0, priceRange[1]])}
                        placeholder="0"
                        className="w-full px-3 py-2 text-[12px] border border-[#EEF0F4] rounded-lg bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45]/40 text-[#0E3470]"
                      />
                    </div>
                    <span className="text-[#9CA3AF] text-[12px] mt-4">—</span>
                    <div className="flex-1">
                      <span className="text-[9px] text-[#9CA3AF] mb-1 block">{t('max')}</span>
                      <input
                        type="number"
                        value={priceRange[1] || ''}
                        onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value) || 0])}
                        placeholder={formatPriceCompact(priceBounds[1])}
                        className="w-full px-3 py-2 text-[12px] border border-[#EEF0F4] rounded-lg bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45]/40 text-[#0E3470]"
                      />
                    </div>
                  </div>
                </div>

                {/* Metric minimums */}
                <div>
                  <label className="text-[10px] font-bold text-[#0E3470] uppercase tracking-[1.5px] mb-3 block">{t('minimumMetrics')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[9px] text-[#9CA3AF] mb-1 block">{t('minIRR')}</span>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.5"
                          value={irrMin || ''}
                          onChange={(e) => setIrrMin(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-7 text-[12px] border border-[#EEF0F4] rounded-lg bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45]/40 text-[#0E3470]"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#9CA3AF]">%</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#9CA3AF] mb-1 block">{t('minCoC')}</span>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.5"
                          value={cocMin || ''}
                          onChange={(e) => setCocMin(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-7 text-[12px] border border-[#EEF0F4] rounded-lg bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45]/40 text-[#0E3470]"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#9CA3AF]">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seller financing toggle */}
                <div>
                  <label className="text-[10px] font-bold text-[#0E3470] uppercase tracking-[1.5px] mb-3 block">{t('dealFeatures')}</label>
                  <span className="text-[9px] text-transparent mb-1 block select-none">&nbsp;</span>
                  <button
                    onClick={() => setSellerFinancingOnly(!sellerFinancingOnly)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-all border ${
                      sellerFinancingOnly
                        ? 'bg-[#0B8A4D]/8 text-[#0B8A4D] border-[#0B8A4D]/25'
                        : 'bg-[#F7F8FA] text-[#6B7280] border-[#EEF0F4] hover:border-[#0B8A4D]/25'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                      sellerFinancingOnly ? 'bg-[#0B8A4D] border-[#0B8A4D]' : 'border-[#D1D5DB]'
                    }`}>
                      {sellerFinancingOnly && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                    {t('sellerFinancingAvailable')}
                  </button>
                </div>
              </div>
            )}

            {/* Active filter summary */}
            {hasActiveFilters && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-[#9CA3AF] font-medium">{filteredDeals.length} {t('resultsFound')}</span>
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EFF6FF] text-[#1D5FB8] rounded-md text-[10px] font-semibold">
                    &quot;{searchQuery}&quot;
                    <button onClick={() => setSearchQuery('')} className="hover:text-[#DC2626] transition-colors"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </span>
                )}
                {[...selectedTypes].map((pt) => (
                  <span key={pt} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0E3470]/8 text-[#0E3470] rounded-md text-[10px] font-semibold">
                    {pt}
                    <button onClick={() => { const n = new Set(selectedTypes); n.delete(pt); setSelectedTypes(n); }} className="hover:text-[#DC2626] transition-colors"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </span>
                ))}
                {sellerFinancingOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#ECFDF5] text-[#0B8A4D] rounded-md text-[10px] font-semibold">
                    {t('sellerFinancing')}
                    <button onClick={() => setSellerFinancingOnly(false)} className="hover:text-[#DC2626] transition-colors"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </span>
                )}
                {irrMin > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FDF8ED] text-[#BC9C45] rounded-md text-[10px] font-semibold">
                    IRR ≥ {irrMin}%
                    <button onClick={() => setIrrMin(0)} className="hover:text-[#DC2626] transition-colors"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </span>
                )}
                {cocMin > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FDF8ED] text-[#BC9C45] rounded-md text-[10px] font-semibold">
                    CoC ≥ {cocMin}%
                    <button onClick={() => setCocMin(0)} className="hover:text-[#DC2626] transition-colors"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      Drafts
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[1.5px] bg-[#0E3470]/10 text-[#0E3470]">
                      Admin only
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#BC9C45]/30 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {draftDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} previewMode={previewMode} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Upcoming Opportunities Section ── */}
              {upcomingDeals.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      {t('upcomingOpportunities')}
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#BC9C45]/30 to-transparent" />
                  </div>
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5 md:gap-6">
                    {upcomingDeals.map((deal, index) => (
                      <ComingSoonCard key={deal.id} deal={deal} index={index} previewMode={previewMode} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Active Deals Section ── */}
              {activeDeals.length > 0 && (
                <div>
                  {(upcomingDeals.length > 0 || assignedDeals.length > 0 || cancelledDeals.length > 0 || closedDeals.length > 0) && (
                    <div className="flex items-center gap-3 mb-5">
                      <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                        {t('activeDeals')}
                      </h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#BC9C45]/30 to-transparent" />
                    </div>
                  )}
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {activeDeals.map((deal, index) => (
                      <div key={deal.id} {...(index === 0 ? { 'data-tour': 'first-deal' } : {})}>
                        <DealCard deal={deal} locale={locale} index={index} previewMode={previewMode} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Assigned Deals Section ── */}
              {assignedDeals.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      {t('assignedDeals')}
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#BC9C45]/30 to-transparent" />
                  </div>
                  <p className="text-[12px] text-[#9CA3AF] mb-5">
                    {t('assignedDealsSubtitle')}
                  </p>
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {assignedDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} previewMode={previewMode} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Cancelled Deals Section ── */}
              {cancelledDeals.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      {t('cancelledDeals')}
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#DC2626]/30 to-transparent" />
                  </div>
                  <p className="text-[12px] text-[#9CA3AF] mb-5">
                    {t('cancelledDealsSubtitle')}
                  </p>
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {cancelledDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} previewMode={previewMode} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Closed Deals Section ── */}
              {closedDeals.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      {t('closedDeals')}
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#9CA3AF]/30 to-transparent" />
                  </div>
                  <div ref={gridRefCallback} className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
                    {closedDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} previewMode={previewMode} />
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
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded flex items-center justify-center">
              <span className="text-white text-[8px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
            </div>
            <span className="text-[10px] text-[#9CA3AF] tracking-wide">
              REPRIME TERMINAL BETA
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
