'use client';

import { useTranslations } from 'next-intl';
import { type DealInputs, type DealMetrics } from '@/lib/utils/deal-calculator';

// Shared formatting
function fmtFull(n: number): string { return '$' + Math.round(n).toLocaleString(); }
function pct(n: number, d = 1): string { return n.toFixed(d) + '%'; }

interface FinancialProps {
  inputs: DealInputs;
  metrics: DealMetrics;
  traditional: DealMetrics | null;
  isEstimated: boolean;
}

// ═══════════════════════════════════════════════════════════
// OVERVIEW TAB — Capital Stack + Return Comparison + Quick CF
// ═══════════════════════════════════════════════════════════
export function OverviewFinancials({ inputs, metrics, traditional }: FinancialProps) {
  const t = useTranslations('portal.financial');
  return (
    <div className="space-y-5">
      {/* Capital Stack */}
      <CapitalStackVisual inputs={inputs} metrics={metrics} isEstimated={false} />

      {/* Return Comparison (mezz only) */}
      {traditional && (
        <ReturnComparison inputs={inputs} metrics={metrics} traditional={traditional} />
      )}

      {/* Quick Cash Flow Summary — every deduction visible */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <h4 className="text-[13px] font-semibold text-[#0E3470] mb-3">{t('cashFlowSummary')}</h4>
        <div className="space-y-0">
          <div className="flex justify-between py-2 border-b border-[#EEF0F4]">
            <span className="text-[13px] text-[#374151]">{t('noi')}</span>
            <span className="text-[14px] font-bold text-[#0E3470] tabular-nums">{fmtFull(inputs.noi)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#EEF0F4]">
            <span className="text-[13px] text-[#6B7280]">− {t('totalDebtService')}</span>
            <span className="text-[14px] font-semibold text-[#DC2626]/80 tabular-nums">{fmtFull(metrics.annualSeniorDS + metrics.annualMezzPayment)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#EEF0F4]">
            <span className="text-[13px] text-[#6B7280]">− {t('assetManagementFee')} ({pct(inputs.assetMgmtFee)})</span>
            <span className="text-[14px] font-semibold text-[#DC2626]/80 tabular-nums">{fmtFull(metrics.assetMgmtFeeDollar)}</span>
          </div>
          <div className="flex justify-between py-3 border-t-2 border-[#0E3470] mt-1">
            <span className="text-[13px] font-bold text-[#374151]">{t('distributableCashFlow')}</span>
            <span className="text-[15px] font-bold tabular-nums" style={{ color: metrics.distributableCashFlow >= 0 ? '#0B8A4D' : '#DC2626' }}>
              {fmtFull(metrics.distributableCashFlow)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DEAL STRUCTURE TAB — Full Detail View
// ═══════════════════════════════════════════════════════════
export function DealStructureFinancials({ inputs, metrics, traditional, isEstimated }: FinancialProps) {
  const t = useTranslations('portal.financial');
  return (
    <div className="space-y-6">
      {/* Capital Stack */}
      <CapitalStackVisual inputs={inputs} metrics={metrics} isEstimated={isEstimated} />

      {/* Cash Flow Waterfall — Full Detail */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
        <h3 className="text-[15px] font-semibold text-[#0E3470] mb-4">{t('annualWaterfall')}</h3>
        {[
          { label: t('noi'), value: inputs.noi, positive: true },
          { label: t('seniorDebtService'), value: -metrics.annualSeniorDS },
          ...(metrics.mezzAmount > 0 ? [{ label: t('mezzIoPayment'), value: -metrics.annualMezzPayment }] : []),
          { label: t('assetManagementFee'), value: -metrics.assetMgmtFeeDollar },
        ].map((row, i) => (
          <div key={i} className={`flex justify-between items-center py-2.5 px-3 ${i % 2 === 0 ? 'bg-[#F7F8FA]' : 'bg-white'} rounded`}>
            <span className={`text-[13px] ${row.positive ? 'text-[#374151] font-medium' : 'text-[#6B7280]'}`}>
              {!row.positive && '−  '}{row.label}
            </span>
            <span className={`text-[14px] font-semibold tabular-nums text-right ${row.positive ? 'text-[#0E3470]' : 'text-[#DC2626]/80'}`}>
              {fmtFull(Math.abs(row.value))}
            </span>
          </div>
        ))}
        <div className="flex justify-between items-center py-3 px-3 mt-1 border-t-2 border-[#0E3470] bg-[#F7F8FA] rounded-b">
          <span className="text-[13px] font-bold text-[#374151]">{t('distributableCashFlow')}</span>
          <span className={`text-[15px] font-bold tabular-nums ${metrics.distributableCashFlow >= 0 ? 'text-[#0B8A4D]' : 'text-[#DC2626]'}`}>
            {fmtFull(metrics.distributableCashFlow)}
          </span>
        </div>
      </div>

      {/* Financing Detail — 3 Blocks */}
      <div className="space-y-4">
        {/* Block 1: Senior Debt */}
        <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-sm bg-[#0E3470]" />
            <h4 className="text-[14px] font-semibold text-[#0E3470]">{t('seniorDebt')}</h4>
            {isEstimated && <span className="text-[10px] italic text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-full">{t('estimated')}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-1">
            {[
              [t('loanAmount'), fmtFull(metrics.loanAmount)],
              [t('ltv'), pct(inputs.ltv)],
              [t('interestRate'), pct(inputs.interestRate, 2)],
              [t('amortization'), `${inputs.amortYears} ${t('years')}`],
              [t('annualDebtService'), fmtFull(metrics.annualSeniorDS)],
              [t('loanOrigination'), `${inputs.loanFeePoints} ${t('points')} (${fmtFull(metrics.loanFeeDollar)})`],
              [inputs.sellerFinancing ? t('lenderDscr') : t('dscr'), metrics.lenderDSCR.toFixed(2) + 'x'],
            ].map(([l, v], i) => (
              <div key={i} className="flex justify-between items-baseline gap-3 py-2 border-b border-[#EEF0F4] last:border-b-0">
                <span className="text-[12px] text-[#6B7280]">{l}</span>
                <span className="text-[12px] font-semibold text-[#0E3470] tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Block 2: Seller Mezzanine */}
        {metrics.mezzAmount > 0 && (
          <div className="bg-white rounded-xl border border-[#BC9C45]/20 p-5 rp-card-shadow">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-sm bg-[#BC9C45]" />
              <h4 className="text-[14px] font-semibold text-[#BC9C45]">{t('sellerMezzanine')}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-1">
              {[
                [t('mezzanineAmount'), fmtFull(metrics.mezzAmount)],
                [t('ofPurchasePrice'), pct(inputs.mezzPercent)],
                [t('interestRate'), pct(inputs.mezzRate, 2)],
                [t('term'), `${inputs.mezzTermMonths} ${t('monthsInterestOnly')}`],
                [t('annualPayment'), fmtFull(metrics.annualMezzPayment)],
                [t('balloonAtMaturity'), fmtFull(metrics.mezzBalloon)],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between items-baseline gap-3 py-2 border-b border-[#EEF0F4] last:border-b-0">
                  <span className="text-[12px] text-[#6B7280]">{l}</span>
                  <span className="text-[12px] font-semibold text-[#BC9C45] tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Block 3: Combined Metrics */}
        <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-[14px] font-semibold text-[#374151]">{t('combinedMetrics')}</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-1">
            {[
              [metrics.mezzAmount > 0 ? t('combinedDscr') : t('lenderDscr'), metrics.combinedDSCR.toFixed(2) + 'x'],
              [t('totalLeverage'), pct(metrics.totalLeverage)],
              [t('totalAnnualDebtObligations'), fmtFull(metrics.annualSeniorDS + metrics.annualMezzPayment)],
            ].map(([l, v], i) => (
              <div key={i} className="flex justify-between items-baseline gap-3 py-2 border-b border-[#EEF0F4] last:border-b-0">
                <span className="text-[12px] text-[#6B7280]">{l}</span>
                <span className="text-[12px] font-bold text-[#0E3470] tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Return Comparison (mezz only) */}
      {traditional && (
        <ReturnComparison inputs={inputs} metrics={metrics} traditional={traditional} />
      )}

      {/* Fee Disclosure — Compact Grid */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <h4 className="text-[14px] font-semibold text-[#0E3470] mb-3">{t('feeDisclosure')}</h4>
        <div className="grid grid-cols-2 gap-x-4 md:gap-x-6 gap-y-1">
          {[
            [`${t('assignmentFee')} (${pct(inputs.assignmentFee)})`, fmtFull(metrics.assignmentFeeDollar)],
            [`${t('acquisitionFee')} (${pct(inputs.acqFee)})`, fmtFull(metrics.acqFeeDollar)],
            [`${t('assetMgmtFee')} (${pct(inputs.assetMgmtFee)}${t('yr')})`, fmtFull(metrics.assetMgmtFeeDollar) + t('yr')],
            [t('gpCarry'), `${pct(inputs.gpCarry, 0)} ${t('above')} ${pct(inputs.prefReturn, 0)} ${t('pref')}`],
            [`${t('loanOrigination')} (${inputs.loanFeePoints} ${t('points')})`, fmtFull(metrics.loanFeeDollar)],
          ].map(([l, v], i) => (
            <div key={i} className="flex justify-between py-1.5 border-b border-[#EEF0F4] last:border-b-0">
              <span className="text-[11px] text-[#6B7280]">{l}</span>
              <span className="text-[11px] font-medium text-[#374151] tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED: Capital Stack Visual
// ═══════════════════════════════════════════════════════════
function CapitalStackVisual({ inputs, metrics, isEstimated }: { inputs: DealInputs; metrics: DealMetrics; isEstimated: boolean }) {
  const t = useTranslations('portal.financial');
  const tp = useTranslations('portal.dealCard');
  // Bar percentages based on Net Basis (purchasePrice - sellerCredit)
  const pp = inputs.purchasePrice;
  const nb = metrics.netBasis;
  const seniorPct = nb > 0 ? (metrics.loanAmount / nb) * 100 : 0;
  const mezzPct = nb > 0 && metrics.mezzAmount > 0 ? (metrics.mezzAmount / nb) * 100 : 0;
  const equityGapPct = nb > 0 ? ((nb - metrics.loanAmount - metrics.mezzAmount) / nb) * 100 : 0;
  const totalCapital = metrics.loanAmount + metrics.mezzAmount + metrics.netEquity;

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
      <h4 className="text-[14px] font-semibold text-[#0E3470] mb-4">{t('capitalStack')}</h4>
      {/* Bar segments based on Net Basis (LTV structure) */}
      <div className="h-9 rounded-lg overflow-hidden flex mb-3">
        {seniorPct > 0 && (
          <div className="flex items-center justify-center text-white text-[10px] font-bold whitespace-nowrap px-1" style={{ width: `${seniorPct}%`, backgroundColor: '#0E3470' }}>
            {t('senior')} {Math.round(seniorPct)}%
          </div>
        )}
        {mezzPct > 0 && (
          <div className="flex items-center justify-center text-white text-[10px] font-bold whitespace-nowrap px-1" style={{ width: `${mezzPct}%`, backgroundColor: '#BC9C45', minWidth: '70px' }}>
            {t('mezz')} {Math.round(mezzPct)}%
          </div>
        )}
        {equityGapPct > 0 && (
          <div className="flex items-center justify-center text-white text-[10px] font-bold whitespace-nowrap px-1" style={{ width: `${equityGapPct}%`, backgroundColor: '#0B8A4D', minWidth: '70px' }}>
            {t('equity')} {Math.round(equityGapPct)}%
          </div>
        )}
      </div>
      {/* Dollar amounts — equity shows actual investor check size */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center py-1.5 border-b border-[#EEF0F4]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#0E3470]" />
            <span className="text-[12px] text-[#374151]">{t('seniorDebt')}</span>
            {isEstimated && <span className="text-[8px] text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-full font-semibold">{t('est')}</span>}
          </div>
          <span className="text-[13px] font-bold text-[#0E3470] tabular-nums">{fmtFull(metrics.loanAmount)}</span>
        </div>
        {metrics.mezzAmount > 0 && (
          <div className="flex justify-between items-center py-1.5 border-b border-[#EEF0F4]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#BC9C45]" />
              <span className="text-[12px] text-[#374151]">{t('sellerMezzanine')}</span>
            </div>
            <span className="text-[13px] font-bold text-[#BC9C45] tabular-nums">{fmtFull(metrics.mezzAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center py-1.5 border-b border-[#EEF0F4]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#0B8A4D]" />
            <span className="text-[12px] text-[#374151]">{t('investorEquity')}</span>
          </div>
          <span className="text-[13px] font-bold text-[#0B8A4D] tabular-nums">{fmtFull(metrics.netEquity)}</span>
        </div>
      </div>
      {/* Summary lines */}
      <div className="mt-3 pt-3 border-t border-[#EEF0F4] space-y-1">
        <div className="flex justify-between items-center text-[12px]">
          <span className="text-[#6B7280]">{tp('purchasePrice')}</span>
          <span className="font-semibold text-[#0E3470] tabular-nums">{fmtFull(pp)}</span>
        </div>
        {inputs.sellerCredit > 0 && (
          <>
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-[#6B7280]">{'\u2212'} {t('sellerCreditAtClosing')}</span>
              <span className="font-semibold text-[#DC2626]/80 tabular-nums">({fmtFull(inputs.sellerCredit)})</span>
            </div>
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-[#6B7280]">{t('netBasis')}</span>
              <span className="font-semibold text-[#0E3470] tabular-nums">{fmtFull(nb)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between items-center text-[12px]">
          <span className="text-[#6B7280]">+ {t('closingCosts')}</span>
          <span className="font-semibold text-[#0E3470] tabular-nums">{fmtFull(metrics.closingCosts)}</span>
        </div>
        <div className="flex justify-between items-center text-[12px]">
          <span className="text-[#6B7280]">{t('totalCapitalRequired')}</span>
          <span className="font-bold text-[#0E3470] tabular-nums">{fmtFull(totalCapital)}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED: Return Comparison Table
// ═══════════════════════════════════════════════════════════
function ReturnComparison({ inputs, metrics, traditional }: { inputs: DealInputs; metrics: DealMetrics; traditional: DealMetrics }) {
  const t = useTranslations('portal.financial');
  const rows = [
    { label: t('seniorDebt'), t: fmtFull(traditional.loanAmount), m: fmtFull(metrics.loanAmount) },
    { label: t('sellerMezz'), t: '—', m: `${fmtFull(metrics.mezzAmount)} ${t('at')} ${pct(inputs.mezzRate)} ${t('io')}` },
    { label: t('investorEquity'), t: fmtFull(traditional.netEquity), m: fmtFull(metrics.netEquity) },
    { label: t('annualCashFlow'), t: fmtFull(traditional.distributableCashFlow), m: fmtFull(metrics.distributableCashFlow) },
    { label: t('cocReturn'), t: pct(traditional.cocReturn, 2), m: pct(metrics.cocReturn, 2), bold: true, greenIfBetter: metrics.cocReturn - traditional.cocReturn > 2 },
    { label: `${t('irr')} (${inputs.holdPeriodYears}yr)`, t: traditional.irr !== null ? pct(traditional.irr, 2) : 'N/A', m: metrics.irr !== null ? pct(metrics.irr, 2) : 'N/A', bold: true, greenIfBetter: (metrics.irr ?? 0) - (traditional.irr ?? 0) > 2 },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
      <h4 className="text-[14px] font-semibold text-[#0E3470] mb-4">{t('returnComparison')}</h4>
      <div className="grid grid-cols-3 gap-0 rounded-lg overflow-hidden border border-[#EEF0F4]">
        <div className="p-3 bg-[#F7F8FA]" />
        <div className="p-3 bg-[#F7F8FA] text-center border-l border-[#EEF0F4]">
          <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[1.5px]">{t('traditionalClose')}</span>
        </div>
        <div className="p-3 text-center border-l border-[#EEF0F4]" style={{ backgroundColor: 'rgba(188,156,69,0.08)' }}>
          <span className="text-[10px] font-bold text-[#BC9C45] uppercase tracking-[1.5px]">{t('withSellerMezz')}</span>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="contents">
            <div className="p-3 border-t border-[#EEF0F4] flex items-center bg-[#F7F8FA]">
              <span className="text-[12px] font-medium text-[#6B7280]">{row.label}</span>
            </div>
            <div className="p-3 border-t border-l border-[#EEF0F4] text-center">
              <span className="text-[12px] text-[#374151] tabular-nums">{row.t}</span>
            </div>
            <div className={`p-3 border-t border-l border-[#EEF0F4] text-center ${row.greenIfBetter ? 'bg-[#ECFDF5]' : ''}`} style={{ backgroundColor: row.greenIfBetter ? undefined : 'rgba(188,156,69,0.04)' }}>
              <span className={`text-[12px] tabular-nums ${row.bold ? 'font-bold' : 'font-semibold'} ${row.greenIfBetter ? 'text-[#0B8A4D]' : 'text-[#0E3470]'}`}>{row.m}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Default export for backward compatibility
export default function FinancialOverview({ deal }: { deal: Record<string, unknown> }) {
  const { parseDealInputs: parse, calculateDeal: calc, calculateTraditionalClose: calcTrad } = require('@/lib/utils/deal-calculator');
  const inputs = parse(deal);
  const metrics = calc(inputs);
  const traditional = inputs.sellerFinancing ? calcTrad(inputs) : null;
  return <DealStructureFinancials inputs={inputs} metrics={metrics} traditional={traditional} isEstimated={!deal.debt_terms_quoted} />;
}
