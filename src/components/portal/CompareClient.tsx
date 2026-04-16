'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { formatPrice, formatPriceCompact, formatPercent, formatDSCR } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/client';
import { Link } from '@/i18n/navigation';

interface DealOption {
  id: string;
  name: string;
  city: string;
  state: string;
  cap_rate: string | null;
}

interface DealFull {
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
  square_footage: string | null;
  units: string | null;
  class_type: string | null;
  year_built: number | null;
  occupancy: string | null;
  seller_financing: boolean;
  deposit_amount: string | null;
}

interface CompareClientProps {
  dealOptions: DealOption[];
  locale: string;
}

const MAX_COLUMNS = 5;
const INITIAL_COLUMNS = 2;
const DEAL_COLORS = ['#0E3470', '#BC9C45', '#009080', '#1D5FB8', '#D97706'];

function num(v: string | null | undefined): number {
  return parseFloat(v ?? '0') || 0;
}

function bestValue(deals: DealFull[], key: keyof DealFull, higher = true): string | null {
  let bestId: string | null = null;
  let bestVal = higher ? -Infinity : Infinity;
  for (const d of deals) {
    const v = num(d[key] as string);
    if (v === 0) continue;
    if ((higher && v > bestVal) || (!higher && v < bestVal)) {
      bestVal = v;
      bestId = d.id;
    }
  }
  return bestId;
}

export default function CompareClient({ dealOptions, locale }: CompareClientProps) {
  const t = useTranslations('portal.compare');
  const tPt = useTranslations('portal.propertyTypes');

  // Each column holds a selected deal ID (or null if empty)
  const [columns, setColumns] = useState<(string | null)[]>(
    Array.from({ length: INITIAL_COLUMNS }, () => null)
  );
  // Cache of fully fetched deals
  const [dealCache, setDealCache] = useState<Record<string, DealFull>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [capShift, setCapShift] = useState(0);

  const fetchDeal = useCallback(async (dealId: string) => {
    if (dealCache[dealId]) return;
    setLoadingIds(prev => new Set(prev).add(dealId));
    const supabase = createClient();
    const { data } = await supabase
      .from('terminal_deals')
      .select('id, name, city, state, property_type, purchase_price, noi, cap_rate, irr, coc, dscr, equity_required, square_footage, units, class_type, year_built, occupancy, seller_financing, deposit_amount')
      .eq('id', dealId)
      .single();
    if (data) {
      setDealCache(prev => ({ ...prev, [dealId]: data as DealFull }));
    }
    setLoadingIds(prev => {
      const next = new Set(prev);
      next.delete(dealId);
      return next;
    });
  }, [dealCache]);

  const handleSelectDeal = (colIndex: number, dealId: string | null) => {
    setColumns(prev => {
      const next = [...prev];
      next[colIndex] = dealId;
      return next;
    });
    if (dealId) fetchDeal(dealId);
  };

  const addColumn = () => {
    if (columns.length < MAX_COLUMNS) {
      setColumns(prev => [...prev, null]);
    }
  };

  const removeColumn = (colIndex: number) => {
    if (columns.length <= INITIAL_COLUMNS) return;
    setColumns(prev => prev.filter((_, i) => i !== colIndex));
  };

  // Per-column resolved deal (null if empty or still loading)
  const columnDeals: (DealFull | null)[] = columns.map(
    (id) => (id ? dealCache[id] ?? null : null)
  );
  // Only the loaded deals (for best-value / verdict calculations)
  const loadedDeals = columnDeals.filter((d): d is DealFull => d !== null);

  // IDs already chosen (to disable in other dropdowns)
  const chosenIds = new Set(columns.filter((id): id is string => id !== null));

  const metrics = [
    { label: t('purchasePrice'), key: 'purchase_price' as const, format: (d: DealFull) => formatPrice(d.purchase_price), higher: false },
    { label: t('noi'), key: 'noi' as const, format: (d: DealFull) => formatPrice(d.noi), higher: true },
    { label: t('capRate'), key: 'cap_rate' as const, format: (d: DealFull) => formatPercent(d.cap_rate), higher: true },
    { label: t('projectedIrr'), key: 'irr' as const, format: (d: DealFull) => formatPercent(d.irr), higher: true },
    { label: t('cashOnCash'), key: 'coc' as const, format: (d: DealFull) => formatPercent(d.coc), higher: true },
    { label: t('dscr'), key: 'dscr' as const, format: (d: DealFull) => formatDSCR(d.dscr), higher: true },
    { label: t('equityRequired'), key: 'equity_required' as const, format: (d: DealFull) => formatPrice(d.equity_required), higher: false },
    { label: t('occupancy'), key: 'occupancy' as const, format: (d: DealFull) => d.occupancy ? `${d.occupancy}%` : '—', higher: true },
    { label: t('yearBuilt'), key: 'year_built' as const, format: (d: DealFull) => d.year_built?.toString() ?? '—', higher: true },
    { label: t('class'), key: 'class_type' as const, format: (d: DealFull) => d.class_type ?? '—', higher: false },
    { label: t('deposit'), key: 'deposit_amount' as const, format: (d: DealFull) => d.deposit_amount ?? '—', higher: false },
  ];

  const sensitivity = useMemo(() => {
    return loadedDeals.map(d => {
      const noi = num(d.noi);
      const currentCap = num(d.cap_rate) / 100;
      const shiftedCap = currentCap + capShift / 10000;
      const currentValue = currentCap > 0 ? noi / currentCap : 0;
      const shiftedValue = shiftedCap > 0 ? noi / shiftedCap : 0;
      const delta = shiftedValue - currentValue;
      return { deal: d, currentValue, shiftedValue, delta, pctChange: currentValue > 0 ? (delta / currentValue) * 100 : 0 };
    });
  }, [loadedDeals, capShift]);

  const verdicts = useMemo(() => {
    if (loadedDeals.length < 2) return [];
    const results = [];

    const highIrr = loadedDeals.reduce((best, d) => num(d.irr) > num(best.irr) ? d : best);
    if (num(highIrr.irr) > 0) results.push({ label: t('highestIrr'), deal: highIrr, value: `${highIrr.irr}%` });

    const lowEquity = loadedDeals.reduce((best, d) => {
      const bv = num(best.equity_required);
      const dv = num(d.equity_required);
      return (dv > 0 && (bv === 0 || dv < bv)) ? d : best;
    });
    if (num(lowEquity.equity_required) > 0) results.push({ label: t('lowestEquity'), deal: lowEquity, value: formatPriceCompact(num(lowEquity.equity_required)) });

    const highCap = loadedDeals.reduce((best, d) => num(d.cap_rate) > num(best.cap_rate) ? d : best);
    if (num(highCap.cap_rate) > 0) results.push({ label: t('highestCapRate'), deal: highCap, value: `${highCap.cap_rate}%` });

    return results;
  }, [loadedDeals, t]);

  // Show comparison table once at least 1 column has a deal selected (loaded or loading)
  const hasAnySelection = columns.some((id) => id !== null);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 md:px-10 md:py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-[24px] font-semibold text-[#0E3470]">
            {t('title')}
          </h1>
          <p className="text-[12px] text-[#9CA3AF] mt-1">{t('subtitle')}</p>
        </div>
        {columns.length < MAX_COLUMNS && (
          <button
            onClick={addColumn}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#BC9C45]/30 text-[#BC9C45] text-[12px] font-semibold hover:bg-[#BC9C45]/5 hover:border-[#BC9C45]/50 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t('addColumn')}
          </button>
        )}
      </div>

      {/* Column Selectors — scrollable on mobile to preserve side-by-side comparison */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))` }}>
        {columns.map((selectedId, colIndex) => {
          const deal = selectedId ? dealCache[selectedId] : null;
          const isLoading = selectedId ? loadingIds.has(selectedId) : false;
          const color = DEAL_COLORS[colIndex % DEAL_COLORS.length];

          return (
            <div
              key={colIndex}
              className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow"
              style={{ borderTopWidth: '3px', borderTopColor: selectedId ? color : '#EEF0F4' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: selectedId ? color : '#D1D5DB' }} />
                  <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#9CA3AF]">
                    {t('deal')} {colIndex + 1}
                  </span>
                </div>
                {columns.length > INITIAL_COLUMNS && (
                  <button
                    onClick={() => removeColumn(colIndex)}
                    className="text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                    aria-label="Remove column"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>

              <select
                value={selectedId ?? ''}
                onChange={(e) => handleSelectDeal(colIndex, e.target.value || null)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#EEF0F4] bg-[#F7F8FA] text-[13px] text-[#0E3470] font-medium focus:outline-none focus:border-[#BC9C45] focus:ring-1 focus:ring-[#BC9C45]/20 transition-colors appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              >
                <option value="">{t('chooseDeal')}</option>
                {dealOptions.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    disabled={chosenIds.has(opt.id) && opt.id !== selectedId}
                  >
                    {opt.name} — {opt.city}, {opt.state} · {formatPercent(opt.cap_rate)} cap
                  </option>
                ))}
              </select>

              {isLoading && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-[#9CA3AF]">
                  <div className="w-3 h-3 border-2 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
                  {t('loading')}
                </div>
              )}

              {deal && !isLoading && (
                <div className="mt-3 space-y-1.5">
                  <Link href={`/portal/deals/${deal.id}`} locale={locale} className="text-[14px] font-semibold text-[#0E3470] hover:text-[#1D5FB8] transition-colors">
                    {deal.name}
                  </Link>
                  <p className="text-[11px] text-[#6B7280]">{deal.city}, {deal.state} · {tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <div>
                      <div className="text-[8px] font-bold uppercase tracking-[1.5px] text-[#9CA3AF]">{t('capRate')}</div>
                      <div className="text-[14px] font-semibold text-[#0E3470] tabular-nums">{formatPercent(deal.cap_rate)}</div>
                    </div>
                    <div>
                      <div className="text-[8px] font-bold uppercase tracking-[1.5px] text-[#9CA3AF]">{t('projectedIrr')}</div>
                      <div className="text-[14px] font-semibold text-[#0B8A4D] tabular-nums">{formatPercent(deal.irr)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {!hasAnySelection ? (
        <div className="bg-white rounded-xl border border-[#EEF0F4] p-12 text-center">
          <p className="text-[14px] text-[#9CA3AF]">{t('selectAtLeast')}</p>
        </div>
      ) : (
        <>
          {/* Metrics Comparison Table — always mirrors all columns */}
          <div className="bg-white rounded-xl border border-[#EEF0F4] overflow-hidden rp-card-shadow">
            <div className="overflow-x-auto">
              {/* Desktop/tablet: metrics as rows, deals as columns */}
              <table className="w-full hidden md:table">
                <thead>
                  <tr className="border-b border-[#EEF0F4]">
                    <th className="text-left px-5 py-4 text-[9px] font-bold uppercase tracking-[2px] text-[#9CA3AF] w-[140px] md:w-[160px] sticky left-0 bg-white z-10">{t('metric')}</th>
                    {columns.map((id, colIndex) => {
                      const deal = columnDeals[colIndex];
                      const isLoading = id ? loadingIds.has(id) : false;
                      const color = DEAL_COLORS[colIndex % DEAL_COLORS.length];
                      return (
                        <th key={colIndex} className="text-left px-5 py-4 min-w-[180px]">
                          {deal ? (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                              <div>
                                <Link href={`/portal/deals/${deal.id}`} locale={locale} className="text-[14px] font-semibold text-[#0E3470] hover:text-[#1D5FB8]">
                                  {deal.name}
                                </Link>
                                <p className="text-[10px] text-[#6B7280]">{deal.city}, {deal.state}</p>
                              </div>
                            </div>
                          ) : isLoading ? (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
                              <span className="text-[12px] text-[#9CA3AF]">{t('loading')}</span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-[#D1D5DB]">{t('deal')} {colIndex + 1}</span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row) => {
                    const best = bestValue(loadedDeals, row.key, row.higher);
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-[#EEF0F4] last:border-b-0 transition-all hover:bg-[#FDF8ED]/40 group"
                        style={{ borderLeft: '3px solid transparent' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = '#BC9C45'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; }}
                      >
                        <td className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.5px] text-[#9CA3AF] sticky left-0 bg-white group-hover:bg-[#FDF8ED]/40 z-10">
                          {row.label}
                        </td>
                        {columns.map((_, colIndex) => {
                          const deal = columnDeals[colIndex];
                          return (
                            <td key={colIndex} className="px-5 py-3">
                              {deal ? (
                                <span className={`text-[14px] font-semibold tabular-nums ${
                                  deal.id === best ? 'text-[#0B8A4D]' : 'text-[#0E3470]'
                                }`}>
                                  {deal.id === best && <span className="text-[10px] mr-1">★</span>}
                                  {row.format(deal)}
                                </span>
                              ) : (
                                <span className="text-[14px] text-[#D1D5DB]">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile: transposed — deals as rows, metrics as columns */}
              <table className="w-full md:hidden">
                <thead>
                  <tr className="border-b border-[#EEF0F4]">
                    <th className="text-left px-4 py-3 text-[9px] font-bold uppercase tracking-[2px] text-[#9CA3AF] w-[140px] sticky left-0 bg-white z-10">{t('deal')}</th>
                    {metrics.map((m) => (
                      <th key={m.key} className="text-left px-4 py-3 text-[9px] font-bold uppercase tracking-[1.5px] text-[#9CA3AF] min-w-[110px] whitespace-nowrap">
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {columns.map((id, colIndex) => {
                    const deal = columnDeals[colIndex];
                    const isLoading = id ? loadingIds.has(id) : false;
                    const color = DEAL_COLORS[colIndex % DEAL_COLORS.length];
                    return (
                      <tr key={colIndex} className="border-b border-[#EEF0F4] last:border-b-0">
                        <td className="px-4 py-3 sticky left-0 bg-white z-10 min-w-0">
                          {deal ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                              <div className="min-w-0">
                                <Link href={`/portal/deals/${deal.id}`} locale={locale} className="block text-[12px] font-semibold text-[#0E3470] truncate">
                                  {deal.name}
                                </Link>
                                <p className="text-[10px] text-[#6B7280] truncate">{deal.city}, {deal.state}</p>
                              </div>
                            </div>
                          ) : isLoading ? (
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 border-2 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
                              <span className="text-[11px] text-[#9CA3AF]">{t('loading')}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#D1D5DB]">{t('deal')} {colIndex + 1}</span>
                          )}
                        </td>
                        {metrics.map((m) => {
                          const best = bestValue(loadedDeals, m.key, m.higher);
                          return (
                            <td key={m.key} className="px-4 py-3">
                              {deal ? (
                                <span className={`text-[13px] font-semibold tabular-nums whitespace-nowrap ${
                                  deal.id === best ? 'text-[#0B8A4D]' : 'text-[#0E3470]'
                                }`}>
                                  {deal.id === best && <span className="text-[9px] mr-0.5">★</span>}
                                  {m.format(deal)}
                                </span>
                              ) : (
                                <span className="text-[13px] text-[#D1D5DB]">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cap Rate Sensitivity — only for loaded deals */}
          {loadedDeals.length > 0 && (
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 md:p-6 rp-card-shadow">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-5">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0E3470]">{t('capRateSensitivity')}</h3>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">{t('whatIfCapRates')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-[#6B7280]">
                    {t('shift')} <span className={`${capShift >= 0 ? 'text-[#DC2626]' : 'text-[#0B8A4D]'} font-bold`}>
                      {capShift >= 0 ? '+' : ''}{capShift} {t('bps')}
                    </span>
                  </span>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="25"
                    value={capShift}
                    onChange={(e) => setCapShift(parseInt(e.target.value))}
                    className="w-full md:w-[200px] h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(90deg, #0B8A4D ${((capShift + 100) / 200) * 100}%, #EEF0F4 ${((capShift + 100) / 200) * 100}%)`,
                    }}
                  />
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0"><div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))` }}>
                {columns.map((_, colIndex) => {
                  const deal = columnDeals[colIndex];
                  const s = sensitivity.find((x) => deal && x.deal.id === deal.id);
                  const color = DEAL_COLORS[colIndex % DEAL_COLORS.length];
                  return (
                    <div key={colIndex} className="rounded-xl p-4 border" style={{ borderColor: deal ? color + '30' : '#EEF0F4', borderLeftWidth: '3px', borderLeftColor: deal ? color : '#EEF0F4' }}>
                      {deal && s ? (
                        <>
                          <div className="text-[12px] font-semibold text-[#0E3470] mb-3">{deal.name}</div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-[10px] text-[#9CA3AF]">{t('currentValue')}</span>
                              <span className="text-[12px] font-semibold text-[#0E3470] tabular-nums">{formatPriceCompact(s.currentValue)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[10px] text-[#9CA3AF]">{t('adjustedValue')}</span>
                              <span className="text-[12px] font-semibold text-[#0E3470] tabular-nums">{formatPriceCompact(s.shiftedValue)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-[#EEF0F4]">
                              <span className="text-[10px] text-[#9CA3AF]">{t('delta')}</span>
                              <span className={`text-[12px] font-bold tabular-nums ${s.delta >= 0 ? 'text-[#0B8A4D]' : 'text-[#DC2626]'}`}>
                                {s.delta >= 0 ? '+' : ''}{formatPriceCompact(s.delta)} ({s.pctChange >= 0 ? '+' : ''}{s.pctChange.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full min-h-[80px]">
                          <span className="text-[12px] text-[#D1D5DB]">—</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div></div>
            </div>
          )}

          {/* Quick Verdict — light theme */}
          {verdicts.length > 0 && (
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 md:p-6 rp-card-shadow">
              <h3 className="text-[12px] font-bold text-[#BC9C45] uppercase tracking-[2px] mb-4">{t('quickVerdict')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {verdicts.map((v) => (
                  <div key={v.label} className="bg-[#F7F8FA] rounded-xl p-4 border border-[#EEF0F4]">
                    <div className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-[1.5px] mb-2">{v.label}</div>
                    <div className="text-[18px] font-bold text-[#0E3470]">{v.value}</div>
                    <div className="text-[11px] text-[#6B7280] mt-1">{v.deal.name} — {v.deal.city}, {v.deal.state}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
