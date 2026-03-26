'use client';

import { useMemo } from 'react';
import { parseDealInputs, calculateDeal, calculateTraditionalClose, type DealMetrics } from '@/lib/utils/deal-calculator';
import type { TerminalDeal } from '@/lib/types/database';

interface FinancialOverviewProps {
  deal: TerminalDeal;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return '$' + Math.round(n).toLocaleString();
  return '$' + n.toFixed(0);
}

function fmtFull(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}

function pct(n: number, decimals = 1): string {
  return n.toFixed(decimals) + '%';
}

export default function FinancialOverview({ deal }: FinancialOverviewProps) {
  const inputs = useMemo(() => parseDealInputs(deal as unknown as Record<string, unknown>), [deal]);
  const metrics = useMemo(() => calculateDeal(inputs), [inputs]);
  const traditional = useMemo(() =>
    inputs.sellerFinancing ? calculateTraditionalClose(inputs) : null
  , [inputs]);

  const isEstimated = !deal.debt_terms_quoted;

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {metrics.warnings.length > 0 && (
        <div className="space-y-2">
          {metrics.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
              <span className="text-[14px]">⚠️</span>
              <span className="text-[13px] font-medium text-[#DC2626]">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Capital Stack */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
        <h3 className="text-[15px] font-semibold text-[#0E3470] mb-5">Capital Stack</h3>

        {/* Visual bar */}
        <div className="h-10 rounded-lg overflow-hidden flex mb-4">
          {metrics.loanAmount > 0 && (
            <div
              className="flex items-center justify-center text-white text-[11px] font-bold"
              style={{ width: `${(metrics.loanAmount / inputs.purchasePrice) * 100}%`, backgroundColor: '#0E3470' }}
            >
              Senior {pct(inputs.ltv, 0)}
            </div>
          )}
          {metrics.mezzAmount > 0 && (
            <div
              className="flex items-center justify-center text-white text-[11px] font-bold"
              style={{ width: `${(metrics.mezzAmount / inputs.purchasePrice) * 100}%`, backgroundColor: '#BC9C45' }}
            >
              Mezz {pct(inputs.mezzPercent, 0)}
            </div>
          )}
          <div
            className="flex items-center justify-center text-white text-[11px] font-bold"
            style={{ width: `${(metrics.grossEquity / inputs.purchasePrice) * 100}%`, backgroundColor: '#0B8A4D' }}
          >
            Equity {pct(100 - inputs.ltv - (inputs.sellerFinancing ? inputs.mezzPercent : 0), 0)}
          </div>
        </div>

        {/* Stack details */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center py-2 border-b border-[#EEF0F4]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#0E3470]" />
              <span className="text-[13px] font-medium text-[#0E3470]">Senior Debt</span>
              {isEstimated && <span className="text-[9px] text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-full font-semibold">Estimated — pending lender quote</span>}
            </div>
            <span className="text-[14px] font-bold text-[#0E3470] tabular-nums">{fmtFull(metrics.loanAmount)}</span>
          </div>
          {metrics.mezzAmount > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-[#EEF0F4]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[#BC9C45]" />
                <span className="text-[13px] font-medium text-[#BC9C45]">Seller Mezzanine</span>
              </div>
              <span className="text-[14px] font-bold text-[#BC9C45] tabular-nums">{fmtFull(metrics.mezzAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-2 border-b border-[#EEF0F4]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-[#0B8A4D]" />
              <span className="text-[13px] font-medium text-[#0B8A4D]">Investor Equity</span>
            </div>
            <span className="text-[14px] font-bold text-[#0B8A4D] tabular-nums">{fmtFull(metrics.netEquity)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[13px] font-semibold text-[#374151]">Total</span>
            <span className="text-[15px] font-bold text-[#0E3470] tabular-nums">{fmtFull(inputs.purchasePrice)}</span>
          </div>
        </div>
      </div>

      {/* Cash Flow Waterfall */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
        <h3 className="text-[15px] font-semibold text-[#0E3470] mb-5">Annual Cash Flow Waterfall</h3>
        <div className="space-y-0">
          {[
            { label: 'Net Operating Income (NOI)', value: inputs.noi, color: '#0E3470', isPositive: true },
            { label: 'Senior Debt Service', value: -metrics.annualSeniorDS, color: '#DC2626' },
            ...(metrics.mezzAmount > 0 ? [{ label: 'Mezzanine IO Payment', value: -metrics.annualMezzPayment, color: '#D97706' }] : []),
            { label: 'Asset Management Fee', value: -metrics.assetMgmtFeeDollar, color: '#6B7280' },
            { label: 'Distributable Cash Flow', value: metrics.distributableCashFlow, color: '#0B8A4D', isResult: true },
          ].map((row, i) => (
            <div key={i} className={`flex justify-between items-center py-3 ${row.isResult ? 'border-t-2 border-[#0E3470] mt-1 pt-4' : 'border-b border-[#EEF0F4]'}`}>
              <span className={`text-[13px] ${row.isResult ? 'font-bold' : 'font-medium'} text-[#374151]`}>
                {!row.isPositive && !row.isResult && '−  '}{row.label}
              </span>
              <span className={`text-[14px] font-bold tabular-nums ${
                row.isResult ? (row.value >= 0 ? 'text-[#0B8A4D]' : 'text-[#DC2626]') :
                row.isPositive ? 'text-[#0E3470]' : 'text-[#DC2626]'
              }`}>
                {row.isPositive || row.isResult ? fmtFull(row.value) : fmtFull(Math.abs(row.value))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Financing Detail */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
        <h3 className="text-[15px] font-semibold text-[#0E3470] mb-5">Financing Detail</h3>

        <div className="space-y-2">
          {[
            { label: 'Senior Loan Amount', value: fmtFull(metrics.loanAmount) },
            { label: 'Senior LTV', value: pct(inputs.ltv) },
            { label: 'Senior Interest Rate', value: pct(inputs.interestRate, 2) },
            { label: 'Senior Amortization', value: `${inputs.amortYears} years` },
            { label: 'Senior Annual Debt Service', value: fmtFull(metrics.annualSeniorDS) },
            { label: 'Loan Origination', value: `${inputs.loanFeePoints} pt(s) (${fmtFull(metrics.loanFeeDollar)})` },
            { label: 'Lender DSCR', value: metrics.lenderDSCR.toFixed(2) + 'x', highlight: metrics.lenderDSCR < 1.2 },
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-[#EEF0F4] last:border-b-0">
              <span className="text-[13px] text-[#6B7280]">{row.label}</span>
              <span className={`text-[13px] font-semibold tabular-nums ${row.highlight ? 'text-[#DC2626]' : 'text-[#0E3470]'}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {metrics.mezzAmount > 0 && (
          <>
            <div className="rp-gold-line my-5" />
            <div className="space-y-2">
              {[
                { label: 'Seller Mezzanine', value: fmtFull(metrics.mezzAmount) },
                { label: 'Mezz % of Purchase Price', value: pct(inputs.mezzPercent) },
                { label: 'Mezz Interest Rate', value: pct(inputs.mezzRate, 2) },
                { label: 'Mezz Term', value: `${inputs.mezzTermMonths} months, Interest-Only` },
                { label: 'Annual Mezz Payment', value: fmtFull(metrics.annualMezzPayment) },
                { label: 'Mezz Balloon at Maturity', value: fmtFull(metrics.mezzBalloon) },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-[#EEF0F4] last:border-b-0">
                  <span className="text-[13px] text-[#6B7280]">{row.label}</span>
                  <span className="text-[13px] font-semibold text-[#BC9C45] tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="rp-gold-line my-5" />
        <div className="space-y-2">
          {[
            { label: metrics.mezzAmount > 0 ? 'Combined DSCR' : 'DSCR', value: metrics.combinedDSCR.toFixed(2) + 'x' },
            { label: 'Total Leverage', value: pct(metrics.totalLeverage) },
            { label: 'Total Annual Debt Obligations', value: fmtFull(metrics.annualSeniorDS + metrics.annualMezzPayment) },
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-[#EEF0F4] last:border-b-0">
              <span className="text-[13px] font-medium text-[#374151]">{row.label}</span>
              <span className="text-[13px] font-bold text-[#0E3470] tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Return Comparison (Mezz deals only) */}
      {traditional && (
        <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
          <h3 className="text-[15px] font-semibold text-[#0E3470] mb-5">Return Comparison</h3>
          <div className="grid grid-cols-3 gap-0">
            {/* Header */}
            <div className="p-3" />
            <div className="p-3 text-center bg-[#F7F8FA] rounded-tl-lg">
              <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-[1.5px]">Traditional Close</span>
            </div>
            <div className="p-3 text-center bg-[#FDF8ED] border-2 border-[#BC9C45]/20 rounded-tr-lg">
              <span className="text-[11px] font-bold text-[#BC9C45] uppercase tracking-[1.5px]">With Seller Mezz</span>
            </div>

            {/* Rows */}
            {[
              { label: 'Senior Debt', t: fmtFull(traditional.loanAmount), m: fmtFull(metrics.loanAmount) },
              { label: 'Seller Mezz', t: '—', m: `${fmtFull(metrics.mezzAmount)} at ${pct(inputs.mezzRate)} IO` },
              { label: 'Investor Equity', t: fmtFull(traditional.netEquity), m: fmtFull(metrics.netEquity) },
              { label: 'Annual Cash Flow', t: fmtFull(traditional.distributableCashFlow), m: fmtFull(metrics.distributableCashFlow) },
              {
                label: 'CoC Return',
                t: pct(traditional.cocReturn),
                m: pct(metrics.cocReturn),
                highlight: metrics.cocReturn - traditional.cocReturn > 2
              },
              {
                label: `IRR (${inputs.holdPeriodYears}yr)`,
                t: traditional.irr !== null ? pct(traditional.irr) : 'N/A',
                m: metrics.irr !== null ? pct(metrics.irr) : 'N/A',
                highlight: (metrics.irr ?? 0) - (traditional.irr ?? 0) > 2
              },
            ].map((row, i) => (
              <div key={i} className="contents">
                <div className="p-3 border-b border-[#EEF0F4] flex items-center">
                  <span className="text-[12px] font-medium text-[#6B7280]">{row.label}</span>
                </div>
                <div className="p-3 border-b border-[#EEF0F4] bg-[#F7F8FA] text-center">
                  <span className="text-[13px] font-semibold text-[#374151] tabular-nums">{row.t}</span>
                </div>
                <div className={`p-3 border-b border-[#EEF0F4] text-center ${row.highlight ? 'bg-[#ECFDF5]' : 'bg-[#FDF8ED]/50'} border-x-2 border-x-[#BC9C45]/20`}>
                  <span className={`text-[13px] font-bold tabular-nums ${row.highlight ? 'text-[#0B8A4D]' : 'text-[#0E3470]'}`}>{row.m}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fee Disclosure */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
        <h3 className="text-[15px] font-semibold text-[#0E3470] mb-5">Fee Disclosure</h3>
        <div className="space-y-2">
          {[
            { label: 'Assignment Fee', value: `${pct(inputs.assignmentFee)} (${fmtFull(metrics.assignmentFeeDollar)})` },
            { label: 'Acquisition Fee', value: `${pct(inputs.acqFee)} (${fmtFull(metrics.acqFeeDollar)})` },
            { label: 'Annual Asset Management Fee', value: `${pct(inputs.assetMgmtFee)} (${fmtFull(metrics.assetMgmtFeeDollar)}/yr)` },
            { label: 'GP Carry', value: `${pct(inputs.gpCarry, 0)} above ${pct(inputs.prefReturn, 0)} preferred return` },
            { label: 'Loan Origination', value: `${inputs.loanFeePoints} pt(s) (${fmtFull(metrics.loanFeeDollar)})` },
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-[#EEF0F4] last:border-b-0">
              <span className="text-[13px] text-[#6B7280]">{row.label}</span>
              <span className="text-[13px] font-medium text-[#374151]">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
