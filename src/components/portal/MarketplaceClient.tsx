'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import DealCard from '@/components/portal/DealCard';
import { formatPriceCompact } from '@/lib/utils/format';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

type SortKey = 'name' | 'purchase_price' | 'cap_rate' | 'irr' | 'coc' | 'equity_required' | 'noi';
type SortDir = 'asc' | 'desc';

interface MarketplaceClientProps {
  deals: DealCardData[];
  locale: string;
}

export default function MarketplaceClient({ deals, locale }: MarketplaceClientProps) {
  const t = useTranslations('portal');
  const tPt = useTranslations('portal.propertyTypes');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [sellerFinancingOnly, setSellerFinancingOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [irrMin, setIrrMin] = useState<number>(0);
  const [cocMin, setCocMin] = useState<number>(0);
  const [sortKey, setSortKey] = useState<SortKey | ''>('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const propertyTypes = useMemo(
    () => [...new Set(deals.map((d) => d.property_type).filter(Boolean))].sort(),
    [deals],
  );
  const priceBounds = useMemo(() => {
    const prices = deals.map((d) => d.purchase_price).filter(Boolean);
    return [Math.min(...prices, 0), Math.max(...prices, 1)] as [number, number];
  }, [deals]);

  useEffect(() => {
    setPriceRange(priceBounds);
  }, [priceBounds]);

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedTypes.size > 0 ||
    sellerFinancingOnly ||
    priceRange[0] > priceBounds[0] ||
    priceRange[1] < priceBounds[1] ||
    irrMin > 0 ||
    cocMin > 0;

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

  const filteredDeals = useMemo(() => {
    let result = deals;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.city.toLowerCase().includes(q) ||
          d.state.toLowerCase().includes(q) ||
          `${d.city} ${d.state}`.toLowerCase().includes(q),
      );
    }

    if (selectedTypes.size > 0) {
      result = result.filter((d) => selectedTypes.has(d.property_type));
    }

    if (sellerFinancingOnly) {
      result = result.filter((d) => d.seller_financing);
    }

    if (priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1]) {
      result = result.filter(
        (d) => d.purchase_price >= priceRange[0] && d.purchase_price <= priceRange[1],
      );
    }

    if (irrMin > 0) result = result.filter((d) => d.irr >= irrMin);
    if (cocMin > 0) result = result.filter((d) => d.coc >= cocMin);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortKey] ?? 0;
        const bVal = b[sortKey] ?? 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
    }

    return result;
  }, [
    deals,
    searchQuery,
    selectedTypes,
    sellerFinancingOnly,
    priceRange,
    priceBounds,
    irrMin,
    cocMin,
    sortKey,
    sortDir,
  ]);

  return (
    <>
      {/* ── Search, Filter & Sort Bar (overlaps the hero gradient fade) ── */}
      <div className="px-4 md:px-10 -mt-14 mb-0 relative z-10">
        <div className="max-w-[1600px] mx-auto">
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
                className="w-full pl-9 pr-3 py-2 text-[13px] text-[#0E3470] bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 focus:border-[#BC9C45]/40 placeholder:text-[#6B7280] transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#0E3470] transition-colors cursor-pointer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

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
                      if (active) next.delete(pt);
                      else next.add(pt);
                      setSelectedTypes(next);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border cursor-pointer ${
                      active
                        ? 'bg-[#BC9C45] text-[#0E3470] border-[#BC9C45] shadow-sm'
                        : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#BC9C45]/50 hover:bg-[#FDF8ED] hover:text-[#0E3470]'
                    }`}
                  >
                    {tPt.has(pt) ? tPt(pt) : pt}
                  </button>
                );
              })}
            </div>

            <div className="hidden md:block w-px h-7 bg-[#EEF0F4]" />

            {/* Filters toggle */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-all border cursor-pointer ${
                filtersOpen || hasActiveFilters
                  ? 'bg-[#FDF8ED] text-[#BC9C45] border-[#BC9C45]/30'
                  : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#FDF8ED] hover:border-[#BC9C45]/50 hover:text-[#0E3470]'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              {t('filters')}
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#BC9C45]" />}
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
                className="appearance-none pl-3 pr-7 py-2 rounded-lg text-[11px] font-semibold bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#FDF8ED] hover:border-[#BC9C45]/50 hover:text-[#0E3470] focus:outline-none focus:ring-2 focus:ring-[#BC9C45]/20 cursor-pointer transition-all"
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

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-[11px] font-semibold text-[#DC2626]/70 hover:text-[#DC2626] transition-colors whitespace-nowrap cursor-pointer"
              >
                {t('clearAll')}
              </button>
            )}
          </div>

          {/* Expandable filter panel */}
          {filtersOpen && (
            <div className="mt-2 bg-white rounded-xl border border-[#EEF0F4] shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-4 md:px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
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
                  <button onClick={() => setSearchQuery('')} className="hover:text-[#DC2626] transition-colors cursor-pointer"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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

      {/* ── Deal grid ── */}
      <div className="max-w-[1600px] mx-auto px-4 py-6 md:px-10 md:py-10">
        {filteredDeals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-6 py-12 text-center">
            <p className="text-[14px] text-gray-400">{t('noMatchingDeals')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDeals.map((deal, i) => (
              <DealCard key={deal.id} deal={deal} locale={locale} index={i} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
