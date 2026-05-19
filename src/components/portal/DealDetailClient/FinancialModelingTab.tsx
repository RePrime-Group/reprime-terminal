'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { parseDealInputs, calculatePropertyMetrics, type DealInputs } from '@/lib/utils/deal-calculator';
import { exportDealToExcel } from '@/lib/utils/excel-export';
import type { DealWithDetails } from '@/lib/types/database';

export function FinancialModelingTab({ deal }: { deal: DealWithDetails }) {
  const t = useTranslations('portal.dealDetail');

  const baseInputs = useMemo(
    () => parseDealInputs(deal as unknown as Record<string, unknown>),
    [deal]
  );
  const baseMetrics = useMemo(() => calculatePropertyMetrics(baseInputs), [baseInputs]);

  const [exitCap, setExitCap] = useState(
    baseInputs.exitCapRate > 0
      ? String(baseInputs.exitCapRate)
      : String(+(baseMetrics.capRate + 1).toFixed(2))
  );
  const [holdYears, setHoldYears] = useState(String(baseInputs.holdPeriodYears || 5));
  const [rentGrowth, setRentGrowth] = useState('3');
  const [ltv, setLtv] = useState(String(baseInputs.ltv));
  const [rate, setRate] = useState(String(baseInputs.interestRate));

  const mm = useMemo(() => {
    const overriddenInputs: DealInputs = {
      ...baseInputs,
      ltv: parseFloat(ltv) || baseInputs.ltv,
      interestRate: parseFloat(rate) || baseInputs.interestRate,
      holdPeriodYears: parseInt(holdYears) || baseInputs.holdPeriodYears || 5,
      exitCapRate: parseFloat(exitCap) || 0,
      rentGrowth: parseFloat(rentGrowth) || 0,
    };
    return calculatePropertyMetrics(overriddenInputs);
  }, [baseInputs, ltv, rate, holdYears, exitCap, rentGrowth]);

  const holdNum = parseInt(holdYears) || 5;
  const exitCapNum = parseFloat(exitCap) || 0;
  const totalProfit = mm.annualCashFlows.reduce((a, b) => a + b, 0) + mm.netSaleProceeds - mm.netEquity;

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString();

  const sliders = [
    { label: t('exitCapRate'), val: exitCap, set: setExitCap, min: '4', max: '15', step: '0.25' },
    { label: t('holdPeriod'), val: holdYears, set: setHoldYears, min: '1', max: '15', step: '1' },
    { label: t('annualRentGrowth'), val: rentGrowth, set: setRentGrowth, min: '0', max: '10', step: '0.5' },
    { label: t('loanToValue'), val: ltv, set: setLtv, min: '0', max: '85', step: '5' },
    { label: t('interestRatePercent'), val: rate, set: setRate, min: '3', max: '10', step: '0.25' },
  ];

  const mmFullyFinanced = mm.netEquity <= 0;
  const mmHasPositiveCF = mm.distributableCashFlow > 0;
  const mmInfReturn = mmFullyFinanced ? (mmHasPositiveCF ? '∞' : 'N/A') : null;
  const greenOrDefault = mmFullyFinanced ? '#0B8A4D' : undefined;
  const results = [
    { l: t('exitValue'), v: fmt(mm.exitPrice), c: '#0E3470' },
    { l: t('totalProfit'), v: fmt(totalProfit), c: totalProfit > 0 ? '#0B8A4D' : '#DC2626' },
    { l: t('equityMultiple'), v: mmInfReturn ?? (mm.equityMultiple !== null ? mm.equityMultiple.toFixed(2) + 'x' : '—'), c: greenOrDefault ?? '#BC9C45' },
    { l: t('estLeveredIrr'), v: mmInfReturn ?? (mm.irr !== null ? mm.irr.toFixed(2) + '%' : 'N/A'), c: '#0B8A4D' },
    { l: t('annualDebtService'), v: fmt(mm.headlineSeniorDS + mm.annualMezzPayment), c: '#0E3470' },
    { l: t('equityRequired'), v: mmFullyFinanced ? '$0' : fmt(mm.netEquity), c: greenOrDefault ?? '#BC9C45' },
  ];

  const exitNOI = baseInputs.noi * Math.pow(1 + (parseFloat(rentGrowth) || 0) / 100, holdNum);

  const handleExportExcel = () => {
    exportDealToExcel(deal, baseInputs, mm, {
      ltv: parseFloat(ltv) || baseInputs.ltv,
      rate: parseFloat(rate) || baseInputs.interestRate,
      holdYears: parseInt(holdYears) || baseInputs.holdPeriodYears || 5,
      exitCap: parseFloat(exitCap) || 0,
      rentGrowth: parseFloat(rentGrowth) || 0,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
      {/* Assumptions Panel */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="font-[family-name:var(--font-playfair)] text-[17px] font-semibold text-[#0E3470]">
            {t('assumptions')}
          </h3>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#FDF8ED] border border-[#BC9C45] text-[#BC9C45] hover:bg-[#BC9C45] hover:text-white text-[11px] font-semibold rounded-lg transition-colors"
            aria-label={t('exportToExcel')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('exportToExcel')}
          </button>
        </div>
        {sliders.map((inp, i) => {
          const pct = ((parseFloat(inp.val) - parseFloat(inp.min)) / (parseFloat(inp.max) - parseFloat(inp.min))) * 100;
          return (
            <div key={i} className="mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-[13px] font-medium text-[#4B5563]">{inp.label}</span>
                <span className="text-[14px] font-semibold text-[#0E3470] tabular-nums">
                  {inp.val}{inp.label.includes('years') ? '' : '%'}
                </span>
              </div>
              <input
                type="range"
                min={inp.min}
                max={inp.max}
                step={inp.step}
                value={inp.val}
                onChange={(e) => inp.set(e.target.value)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(90deg, #BC9C45 ${pct}%, #EEF0F4 ${pct}%)`,
                }}
              />
            </div>
          );
        })}
        <div className="mt-3 p-3 bg-[#FDF8ED] rounded-lg border border-[#ECD9A0]/30">
          <div className="text-[10px] font-semibold text-[#BC9C45] uppercase tracking-[2px] mb-1">{t('basis')}</div>
          <div className="text-[12px] text-[#4B5563]">
            {t('purchase')} {fmt(mm.netBasis)} · {t('cap')} {mm.capRate.toFixed(2)}% · {t('noi')} {fmt(baseInputs.noi)}
          </div>
        </div>
      </div>

      {/* Results Panel */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {results.map((m, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-3.5 border border-[#EEF0F4] rp-card-shadow"
              style={{ borderLeft: `3px solid ${m.c}` }}
            >
              <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[2px]">{m.l}</div>
              <div className="text-[22px] font-bold tabular-nums mt-1.5" style={{ color: m.c }}>{m.v}</div>
            </div>
          ))}
        </div>

        {/* Cash flow chart */}
        <div className="bg-white rounded-xl p-4 md:p-5 border border-[#EEF0F4] rp-card-shadow overflow-hidden">
          <h4 className="text-[14px] font-semibold text-[#0E3470] mb-3">{t('projectedAnnualCashFlow')}</h4>
          {(() => {
            const chartH = 180;
            const cashFlows = mm.annualCashFlows;
            const maxCF = Math.max(...cashFlows, 0);
            const minCF = Math.min(...cashFlows);
            const range = maxCF - minCF || maxCF * 0.2 || 100_000;
            const steps = [5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000];
            const step = steps.find(s => Math.ceil(range / s) <= 5) ?? steps[steps.length - 1];
            const yFloor = Math.max(0, Math.floor(minCF / step) * step);
            const yCeil = Math.ceil(maxCF * 1.05 / step) * step;
            const ticks: number[] = [];
            for (let v = yFloor; v <= yCeil; v += step) ticks.push(v);
            const yRange = yCeil - yFloor || 1;
            const yLabel = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1_000).toLocaleString()}K`;

            return (
              <div>
                <div className="flex">
                  <div className="relative shrink-0 w-[44px]" style={{ height: chartH }}>
                    {ticks.map((tick) => {
                      const bottom = ((tick - yFloor) / yRange) * 100;
                      return (
                        <span
                          key={tick}
                          className="absolute right-1 text-[8px] text-[#9CA3AF] tabular-nums leading-none whitespace-nowrap"
                          style={{ bottom: `${bottom}%`, transform: 'translateY(50%)' }}
                        >
                          {yLabel(tick)}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex-1 relative" style={{ height: chartH }}>
                    {ticks.map((tick) => {
                      const bottom = ((tick - yFloor) / yRange) * 100;
                      return (
                        <div
                          key={tick}
                          className="absolute left-0 right-0 border-t border-[#EEF0F4]"
                          style={{ bottom: `${bottom}%` }}
                        />
                      );
                    })}
                    <div className="flex items-end gap-1.5 md:gap-3 relative z-10 h-full px-1 md:px-2">
                      {cashFlows.map((cf, i) => {
                        const barH = yRange > 0 ? Math.max(((cf - yFloor) / yRange) * chartH, 4) : 4;
                        return (
                          <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
                            <span className="text-[8px] md:text-[9px] font-bold tabular-nums mb-1 whitespace-nowrap" style={{ color: cf > 0 ? '#0B8A4D' : '#DC2626' }}>
                              {fmt(cf)}
                            </span>
                            <div
                              className="w-full rounded-t-lg transition-all duration-500"
                              style={{
                                height: barH,
                                background: cf > 0
                                  ? 'linear-gradient(180deg, #0B8A4D, rgba(11,138,77,0.3))'
                                  : 'linear-gradient(180deg, #DC2626, rgba(220,38,38,0.3))',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex" style={{ marginLeft: 44 }}>
                  <div className="flex-1 flex gap-1.5 md:gap-3 px-1 md:px-2">
                    {cashFlows.map((_, i) => (
                      <div key={i} className="flex-1 text-center">
                        <span className="text-[9px] text-[#9CA3AF] font-semibold">{t('yr')} {i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Cap rate sensitivity */}
        <div className="bg-white rounded-xl p-5 border border-[#EEF0F4] rp-card-shadow">
          <h4 className="text-[14px] font-semibold text-[#0E3470] mb-3">{t('capRateSensitivity')}</h4>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[6.0, 6.5, 7.0, 7.5, 8.0].map((cr) => {
              const ev = exitNOI / (cr / 100);
              const isSel = cr === exitCapNum;
              return (
                <button
                  key={cr}
                  onClick={() => setExitCap(String(cr))}
                  className="text-center py-2.5 px-1 rounded-lg transition-all cursor-pointer hover:ring-2 hover:ring-[#BC9C45]/30"
                  style={{ background: isSel ? '#0E3470' : '#F7F8FA' }}
                >
                  <div className="text-[11px] font-bold" style={{ color: isSel ? '#D4A843' : '#9CA3AF' }}>{cr}%</div>
                  <div className="text-[13px] font-bold mt-1 tabular-nums" style={{ color: isSel ? '#FFFFFF' : '#0E3470' }}>{fmt(ev)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
