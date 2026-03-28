'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { formatPrice, formatPriceCompact, formatPercent, formatDSCR } from '@/lib/utils/format';
import { Link } from '@/i18n/navigation';

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
  square_footage: string | null;
  units: string | null;
  class_type: string | null;
  year_built: number | null;
  occupancy: string | null;
  seller_financing: boolean;
  deposit_amount: string | null;
  photo_url: string | null;
}

interface CompareClientProps {
  deals: Deal[];
  locale: string;
}

const DEAL_COLORS = ['#0E3470', '#BC9C45', '#009080', '#1D5FB8', '#D97706'];

function num(v: string | null | undefined): number {
  return parseFloat(v ?? '0') || 0;
}

function bestValue(deals: Deal[], key: keyof Deal, higher = true): string | null {
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

export default function CompareClient({ deals, locale }: CompareClientProps) {
  const t = useTranslations('portal.compare');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(deals.slice(0, 3).map(d => d.id)));
  const [capShift, setCapShift] = useState(0);

  const toggleDeal = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selected = deals.filter(d => selectedIds.has(d.id));

  const metrics = [
    { label: t('purchasePrice'), key: 'purchase_price' as const, format: (d: Deal) => formatPrice(d.purchase_price), higher: false },
    { label: t('noi'), key: 'noi' as const, format: (d: Deal) => formatPrice(d.noi), higher: true },
    { label: t('capRate'), key: 'cap_rate' as const, format: (d: Deal) => formatPercent(d.cap_rate), higher: true },
    { label: t('projectedIrr'), key: 'irr' as const, format: (d: Deal) => formatPercent(d.irr), higher: true },
    { label: t('cashOnCash'), key: 'coc' as const, format: (d: Deal) => formatPercent(d.coc), higher: true },
    { label: t('dscr'), key: 'dscr' as const, format: (d: Deal) => formatDSCR(d.dscr), higher: true },
    { label: t('equityRequired'), key: 'equity_required' as const, format: (d: Deal) => formatPrice(d.equity_required), higher: false },
    { label: t('occupancy'), key: 'occupancy' as const, format: (d: Deal) => d.occupancy ? `${d.occupancy}%` : '—', higher: true },
    { label: t('yearBuilt'), key: 'year_built' as const, format: (d: Deal) => d.year_built?.toString() ?? '—', higher: true },
    { label: t('class'), key: 'class_type' as const, format: (d: Deal) => d.class_type ?? '—', higher: false },
    { label: t('deposit'), key: 'deposit_amount' as const, format: (d: Deal) => d.deposit_amount ?? '—', higher: false },
  ];

  // Cap rate sensitivity
  const sensitivity = useMemo(() => {
    return selected.map(d => {
      const noi = num(d.noi);
      const currentCap = num(d.cap_rate) / 100;
      const shiftedCap = currentCap + capShift / 10000;
      const currentValue = currentCap > 0 ? noi / currentCap : 0;
      const shiftedValue = shiftedCap > 0 ? noi / shiftedCap : 0;
      const delta = shiftedValue - currentValue;
      return { deal: d, currentValue, shiftedValue, delta, pctChange: currentValue > 0 ? (delta / currentValue) * 100 : 0 };
    });
  }, [selected, capShift]);

  // Quick verdict
  const verdicts = useMemo(() => {
    if (selected.length < 2) return [];
    const results = [];

    const highIrr = selected.reduce((best, d) => num(d.irr) > num(best.irr) ? d : best);
    if (num(highIrr.irr) > 0) results.push({ label: t('highestIrr'), deal: highIrr, value: `${highIrr.irr}%` });

    const lowEquity = selected.reduce((best, d) => {
      const bv = num(best.equity_required);
      const dv = num(d.equity_required);
      return (dv > 0 && (bv === 0 || dv < bv)) ? d : best;
    });
    if (num(lowEquity.equity_required) > 0) results.push({ label: t('lowestEquity'), deal: lowEquity, value: formatPriceCompact(num(lowEquity.equity_required)) });

    const highCap = selected.reduce((best, d) => num(d.cap_rate) > num(best.cap_rate) ? d : best);
    if (num(highCap.cap_rate) > 0) results.push({ label: t('highestCapRate'), deal: highCap, value: `${highCap.cap_rate}%` });

    return results;
  }, [selected]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-[24px] font-semibold text-[#0E3470]">
            {t('title')}
          </h1>
          <p className="text-[12px] text-[#9CA3AF] mt-1">{t('subtitle')}</p>
        </div>
        {selected.length > 0 && (
          <span className="px-4 py-1.5 rounded-lg bg-[#FDF8ED] border border-[#ECD9A0] text-[12px] font-bold text-[#BC9C45]">
            {selected.length} {t('selected')}
          </span>
        )}
      </div>

      {/* Deal Selector Cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {deals.map((deal, i) => {
          const isSel = selectedIds.has(deal.id);
          return (
            <button
              key={deal.id}
              onClick={() => toggleDeal(deal.id)}
              className={`text-left p-4 rounded-xl transition-all duration-200 ${
                isSel
                  ? 'border-2 border-[#BC9C45] bg-[#FDF8ED] shadow-[0_0_0_3px_rgba(188,156,69,0.15)]'
                  : 'border border-[#EEF0F4] bg-white hover:border-[#D1D5DB]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                  isSel ? 'bg-[#BC9C45]' : 'bg-[#F7F8FA] border border-[#D1D5DB]'
                }`}>
                  {isSel && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                {deal.photo_url && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <img src={deal.photo_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#0E3470] truncate">{deal.name}</div>
                  <div className="text-[10px] text-[#6B7280]">
                    {deal.city}, {deal.state} · {formatPercent(deal.cap_rate)} {t('cap')}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected.length < 2 ? (
        <div className="bg-white rounded-xl border border-[#EEF0F4] p-12 text-center">
          <p className="text-[14px] text-[#9CA3AF]">{t('selectAtLeast')}</p>
        </div>
      ) : (
        <>
          {/* Metrics Comparison Table */}
          <div className="bg-white rounded-xl border border-[#EEF0F4] overflow-hidden rp-card-shadow">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#EEF0F4]">
                    <th className="text-left px-5 py-4 text-[9px] font-bold uppercase tracking-[2px] text-[#9CA3AF] w-[160px]">{t('metric')}</th>
                    {selected.map((deal, i) => (
                      <th key={deal.id} className="text-left px-5 py-4 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: DEAL_COLORS[i % DEAL_COLORS.length] }} />
                          <div>
                            <Link href={`/portal/deals/${deal.id}`} locale={locale} className="text-[14px] font-semibold text-[#0E3470] hover:text-[#1D5FB8]">
                              {deal.name}
                            </Link>
                            <p className="text-[10px] text-[#6B7280]">{deal.city}, {deal.state}</p>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row, idx) => {
                    const best = bestValue(selected, row.key, row.higher);
                    return (
                      <tr
                        key={row.key}
                        className={`border-b border-[#EEF0F4] last:border-b-0 transition-all hover:bg-[#FDF8ED]/40 group`}
                        style={{ borderLeft: '3px solid transparent' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = '#BC9C45'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; }}
                      >
                        <td className="px-5 py-3 text-[10px] font-bold uppercase tracking-[1.5px] text-[#9CA3AF]">
                          {row.label}
                        </td>
                        {selected.map((deal) => (
                          <td key={deal.id} className="px-5 py-3">
                            <span className={`text-[14px] font-semibold tabular-nums ${
                              deal.id === best ? 'text-[#0B8A4D]' : 'text-[#0E3470]'
                            }`}>
                              {deal.id === best && <span className="text-[10px] mr-1">★</span>}
                              {row.format(deal)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cap Rate Sensitivity */}
          <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
            <div className="flex items-center justify-between mb-5">
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
                  className="w-[200px] h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(90deg, #0B8A4D ${((capShift + 100) / 200) * 100}%, #EEF0F4 ${((capShift + 100) / 200) * 100}%)`,
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${selected.length}, 1fr)` }}>
              {sensitivity.map((s, i) => (
                <div key={s.deal.id} className="rounded-xl p-4 border" style={{ borderColor: DEAL_COLORS[i % DEAL_COLORS.length] + '30', borderLeftWidth: '3px', borderLeftColor: DEAL_COLORS[i % DEAL_COLORS.length] }}>
                  <div className="text-[12px] font-semibold text-[#0E3470] mb-3">{s.deal.name}</div>
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
                </div>
              ))}
            </div>
          </div>

          {/* Quick Verdict */}
          {verdicts.length > 0 && (
            <div className="bg-gradient-to-br from-[#07090F] via-[#0A1628] to-[#0E3470] rounded-xl p-6 rp-card-shadow">
              <h3 className="text-[12px] font-bold text-[#D4A843] uppercase tracking-[2px] mb-4">{t('quickVerdict')}</h3>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${verdicts.length}, 1fr)` }}>
                {verdicts.map((v) => (
                  <div key={v.label} className="bg-white/[0.05] rounded-xl p-4 border border-white/[0.06]">
                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-[1.5px] mb-2">{v.label}</div>
                    <div className="text-[18px] font-bold text-white">{v.value}</div>
                    <div className="text-[11px] text-white/50 mt-1">{v.deal.name} — {v.deal.city}, {v.deal.state}</div>
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
