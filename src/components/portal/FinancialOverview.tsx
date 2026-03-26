'use client';

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
  return (
    <div className="space-y-5">
      {/* Capital Stack */}
      <CapitalStackVisual inputs={inputs} metrics={metrics} isEstimated={false} />

      {/* Return Comparison (mezz only) */}
      {traditional && (
        <ReturnComparison inputs={inputs} metrics={metrics} traditional={traditional} />
      )}

      {/* Quick Cash Flow Summary */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <h4 className="text-[13px] font-semibold text-[#0E3470] mb-3">Cash Flow Summary</h4>
        <div className="space-y-0">
          <div className="flex justify-between py-2 border-b border-[#EEF0F4]">
            <span className="text-[13px] text-[#374151]">Net Operating Income (NOI)</span>
            <span className="text-[14px] font-bold text-[#0E3470] tabular-nums">{fmtFull(inputs.noi)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#EEF0F4]">
            <span className="text-[13px] text-[#6B7280]">− Total Debt Service</span>
            <span className="text-[14px] font-semibold text-[#DC2626] tabular-nums">{fmtFull(metrics.annualSeniorDS + metrics.annualMezzPayment)}</span>
          </div>
          <div className="flex justify-between py-3 border-t-2 border-[#0E3470] mt-1">
            <span className="text-[13px] font-bold text-[#374151]">Distributable Cash Flow</span>
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
  return (
    <div className="space-y-6">
      {/* Capital Stack */}
      <CapitalStackVisual inputs={inputs} metrics={metrics} isEstimated={isEstimated} />

      {/* Cash Flow Waterfall — Full Detail */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
        <h3 className="text-[15px] font-semibold text-[#0E3470] mb-4">Annual Cash Flow Waterfall</h3>
        {[
          { label: 'Net Operating Income (NOI)', value: inputs.noi, positive: true },
          { label: 'Senior Debt Service', value: -metrics.annualSeniorDS },
          ...(metrics.mezzAmount > 0 ? [{ label: 'Mezzanine IO Payment', value: -metrics.annualMezzPayment }] : []),
          { label: 'Asset Management Fee', value: -metrics.assetMgmtFeeDollar },
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
          <span className="text-[13px] font-bold text-[#374151]">Distributable Cash Flow</span>
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
            <h4 className="text-[14px] font-semibold text-[#0E3470]">Senior Debt</h4>
            {isEstimated && <span className="text-[10px] italic text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-full">Estimated — pending lender quote</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            {[
              ['Loan Amount', fmtFull(metrics.loanAmount)],
              ['LTV', pct(inputs.ltv)],
              ['Interest Rate', pct(inputs.interestRate, 2)],
              ['Amortization', `${inputs.amortYears} years`],
              ['Annual Debt Service', fmtFull(metrics.annualSeniorDS)],
              ['Loan Origination', `${inputs.loanFeePoints} pt(s) (${fmtFull(metrics.loanFeeDollar)})`],
              [inputs.sellerFinancing ? 'Lender DSCR' : 'DSCR', metrics.lenderDSCR.toFixed(2) + 'x'],
            ].map(([l, v], i) => (
              <div key={i} className="flex justify-between py-2 border-b border-[#EEF0F4] last:border-b-0">
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
              <h4 className="text-[14px] font-semibold text-[#BC9C45]">Seller Mezzanine</h4>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              {[
                ['Mezzanine Amount', fmtFull(metrics.mezzAmount)],
                ['% of Purchase Price', pct(inputs.mezzPercent)],
                ['Interest Rate', pct(inputs.mezzRate, 2)],
                ['Term', `${inputs.mezzTermMonths} months, Interest-Only`],
                ['Annual Payment', fmtFull(metrics.annualMezzPayment)],
                ['Balloon at Maturity', fmtFull(metrics.mezzBalloon)],
              ].map(([l, v], i) => (
                <div key={i} className="flex justify-between py-2 border-b border-[#EEF0F4] last:border-b-0">
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
            <h4 className="text-[14px] font-semibold text-[#374151]">Combined Metrics</h4>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            {[
              [metrics.mezzAmount > 0 ? 'Combined DSCR' : 'Lender DSCR', metrics.combinedDSCR.toFixed(2) + 'x'],
              ['Total Leverage', pct(metrics.totalLeverage)],
              ['Total Annual Debt Obligations', fmtFull(metrics.annualSeniorDS + metrics.annualMezzPayment)],
            ].map(([l, v], i) => (
              <div key={i} className="flex justify-between py-2 border-b border-[#EEF0F4] last:border-b-0">
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
        <h4 className="text-[14px] font-semibold text-[#0E3470] mb-3">Fee Disclosure</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {[
            [`Assignment Fee (${pct(inputs.assignmentFee)})`, fmtFull(metrics.assignmentFeeDollar)],
            [`Acquisition Fee (${pct(inputs.acqFee)})`, fmtFull(metrics.acqFeeDollar)],
            [`Asset Mgmt Fee (${pct(inputs.assetMgmtFee)}/yr)`, fmtFull(metrics.assetMgmtFeeDollar) + '/yr'],
            [`GP Carry`, `${pct(inputs.gpCarry, 0)} above ${pct(inputs.prefReturn, 0)} pref`],
            [`Loan Origination (${inputs.loanFeePoints} pt)`, fmtFull(metrics.loanFeeDollar)],
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
  const equityPct = inputs.purchasePrice > 0 ? 100 - inputs.ltv - (inputs.sellerFinancing ? inputs.mezzPercent : 0) : 0;

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
      <h4 className="text-[14px] font-semibold text-[#0E3470] mb-4">Capital Stack</h4>
      <div className="h-9 rounded-lg overflow-hidden flex mb-3">
        {metrics.loanAmount > 0 && (
          <div className="flex items-center justify-center text-white text-[10px] font-bold" style={{ width: `${(metrics.loanAmount / inputs.purchasePrice) * 100}%`, backgroundColor: '#0E3470' }}>
            Senior {pct(inputs.ltv, 0)}
          </div>
        )}
        {metrics.mezzAmount > 0 && (
          <div className="flex items-center justify-center text-white text-[10px] font-bold" style={{ width: `${(metrics.mezzAmount / inputs.purchasePrice) * 100}%`, backgroundColor: '#BC9C45' }}>
            Mezz {pct(inputs.mezzPercent, 0)}
          </div>
        )}
        <div className="flex items-center justify-center text-white text-[10px] font-bold" style={{ width: `${equityPct}%`, backgroundColor: '#0B8A4D', minWidth: '40px' }}>
          Equity
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center py-1.5 border-b border-[#EEF0F4]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#0E3470]" />
            <span className="text-[12px] text-[#374151]">Senior Debt</span>
            {isEstimated && <span className="text-[8px] text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-full font-semibold">Est.</span>}
          </div>
          <span className="text-[13px] font-bold text-[#0E3470] tabular-nums">{fmtFull(metrics.loanAmount)}</span>
        </div>
        {metrics.mezzAmount > 0 && (
          <div className="flex justify-between items-center py-1.5 border-b border-[#EEF0F4]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#BC9C45]" />
              <span className="text-[12px] text-[#374151]">Seller Mezzanine</span>
            </div>
            <span className="text-[13px] font-bold text-[#BC9C45] tabular-nums">{fmtFull(metrics.mezzAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center py-1.5 border-b border-[#EEF0F4]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#0B8A4D]" />
            <span className="text-[12px] text-[#374151]">Investor Equity</span>
          </div>
          <span className="text-[13px] font-bold text-[#0B8A4D] tabular-nums">{fmtFull(metrics.netEquity)}</span>
        </div>
        <div className="flex justify-between items-center py-1.5">
          <span className="text-[12px] font-semibold text-[#374151]">Total</span>
          <span className="text-[14px] font-bold text-[#0E3470] tabular-nums">{fmtFull(inputs.purchasePrice)}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED: Return Comparison Table
// ═══════════════════════════════════════════════════════════
function ReturnComparison({ inputs, metrics, traditional }: { inputs: DealInputs; metrics: DealMetrics; traditional: DealMetrics }) {
  const rows = [
    { label: 'Senior Debt', t: fmtFull(traditional.loanAmount), m: fmtFull(metrics.loanAmount) },
    { label: 'Seller Mezz', t: '—', m: `${fmtFull(metrics.mezzAmount)} at ${pct(inputs.mezzRate)} IO` },
    { label: 'Investor Equity', t: fmtFull(traditional.netEquity), m: fmtFull(metrics.netEquity) },
    { label: 'Annual Cash Flow', t: fmtFull(traditional.distributableCashFlow), m: fmtFull(metrics.distributableCashFlow) },
    { label: 'CoC Return', t: pct(traditional.cocReturn), m: pct(metrics.cocReturn), bold: true, greenIfBetter: metrics.cocReturn - traditional.cocReturn > 2 },
    { label: `IRR (${inputs.holdPeriodYears}yr)`, t: traditional.irr !== null ? pct(traditional.irr) : 'N/A', m: metrics.irr !== null ? pct(metrics.irr) : 'N/A', bold: true, greenIfBetter: (metrics.irr ?? 0) - (traditional.irr ?? 0) > 2 },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
      <h4 className="text-[14px] font-semibold text-[#0E3470] mb-4">Return Comparison</h4>
      <div className="grid grid-cols-3 gap-0 rounded-lg overflow-hidden border border-[#EEF0F4]">
        <div className="p-3 bg-[#F7F8FA]" />
        <div className="p-3 bg-[#F7F8FA] text-center border-l border-[#EEF0F4]">
          <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[1.5px]">Traditional Close</span>
        </div>
        <div className="p-3 text-center border-l border-[#EEF0F4]" style={{ backgroundColor: 'rgba(188,156,69,0.08)' }}>
          <span className="text-[10px] font-bold text-[#BC9C45] uppercase tracking-[1.5px]">With Seller Mezz</span>
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
