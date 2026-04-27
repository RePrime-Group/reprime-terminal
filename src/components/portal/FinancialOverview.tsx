'use client';

import { useTranslations } from 'next-intl';
import { type DealInputs, type DealMetrics } from '@/lib/utils/deal-calculator';
import type { FeeDefaults } from '@/lib/utils/fee-resolver';

// Shared formatting
function fmtFull(n: number): string { return '$' + Math.round(n).toLocaleString(); }
function pct(n: number, d = 1): string { return n.toFixed(d) + '%'; }

interface FinancialProps {
  inputs: DealInputs;
  metrics: DealMetrics;
  traditional: DealMetrics | null;
  isEstimated: boolean;
  /** Resolved REPRIME fee terms — used by the Fee Disclosure section only.
   *  Falls back to `inputs.*Fee` when not provided, preserving pre-resolver behavior. */
  feeDisclosure?: FeeDefaults;
}

// ═══════════════════════════════════════════════════════════
// OVERVIEW TAB — Capital Stack + Return Comparison + Quick CF
// ═══════════════════════════════════════════════════════════
export function OverviewFinancials({ inputs, metrics, traditional }: FinancialProps) {
  const t = useTranslations('portal.financial');
  return (
    <div className="space-y-4">
      {/* Capital Stack */}
      <CapitalStackVisual inputs={inputs} metrics={metrics} isEstimated={false} />

      {/* Return Comparison (mezz only) */}
      {traditional && (
        <ReturnComparison inputs={inputs} metrics={metrics} traditional={traditional} />
      )}

      {/* Quick Cash Flow Summary — every deduction visible */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
        <h4 className="text-[14px] font-semibold text-[#0E3470] mb-2">{t('cashFlowSummary')}</h4>
        <div className="space-y-0">
          <div className="flex justify-between py-1.5 border-b border-[#EEF0F4]">
            <span className="text-[14px] text-[#374151]">{t('noi')}</span>
            <span className="text-[15px] font-bold text-[#0E3470] tabular-nums">{fmtFull(inputs.noi)}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[#EEF0F4]">
            <span className="text-[14px] text-[#6B7280]">− {t('capexReserves')}</span>
            {metrics.capex > 0 ? (
              <span className="text-[15px] font-semibold text-[#DC2626]/80 tabular-nums">{fmtFull(metrics.capex)}</span>
            ) : (
              <span className="text-[13px] font-medium text-[#6B7280] italic">Calculated at Closing*</span>
            )}
          </div>
          <div className="flex justify-between py-1.5 border-b border-[#EEF0F4]">
            <span className="text-[14px] text-[#6B7280]">
              − {metrics.ioPeriodMonths > 0 ? t('seniorDebtServiceIO') + '*' : t('seniorDebtService')}
            </span>
            <span className="text-[15px] font-semibold text-[#DC2626]/80 tabular-nums">{fmtFull(metrics.headlineSeniorDS)}</span>
          </div>
          {metrics.mezzAmount > 0 && (
            <div className="flex justify-between py-1.5 border-b border-[#EEF0F4]">
              <span className="text-[14px] text-[#6B7280]">− {t('mezzIoPayment')}</span>
              <span className="text-[15px] font-semibold text-[#DC2626]/80 tabular-nums">{fmtFull(metrics.annualMezzPayment)}</span>
            </div>
          )}
          {inputs.assetMgmtFee > 0 && (
            <div className="flex justify-between py-1.5 border-b border-[#EEF0F4]">
              <span className="text-[14px] text-[#6B7280]">− {t('assetManagementFee')} ({pct(inputs.assetMgmtFee)})</span>
              <span className="text-[15px] font-semibold text-[#DC2626]/80 tabular-nums">{fmtFull(metrics.assetMgmtFeeDollar)}</span>
            </div>
          )}
          <div className="flex justify-between py-2.5 border-t-2 border-[#0E3470] mt-1">
            <span className="text-[14px] font-bold text-[#374151]">{t('distributableCashFlow')}</span>
            <span className="text-[16px] font-bold tabular-nums" style={{ color: metrics.distributableCashFlow >= 0 ? '#0B8A4D' : '#DC2626' }}>
              {fmtFull(metrics.distributableCashFlow)}
            </span>
          </div>
        </div>
        {metrics.ioPeriodMonths > 0 && (
          <p className="mt-3 text-[11px] text-[#9CA3AF] leading-relaxed italic">
            {t('ioFootnote', { months: metrics.ioPeriodMonths, piAmount: fmtFull(metrics.annualSeniorDS) })}
          </p>
        )}
        {metrics.capex === 0 && (
          <p className="mt-3 text-[11px] text-[#9CA3AF] leading-relaxed italic">
            * CapEx reserves will be determined during due diligence and reflected in final offering terms.
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DEAL STRUCTURE TAB — Full Detail View
// ═══════════════════════════════════════════════════════════
export function DealStructureFinancials({ inputs, metrics, traditional, isEstimated, feeDisclosure }: FinancialProps) {
  const t = useTranslations('portal.financial');
  return (
    <div className="space-y-5">
      {/* Capital Stack */}
      <CapitalStackVisual inputs={inputs} metrics={metrics} isEstimated={isEstimated} />

      {/* Cash Flow Waterfall — Full Detail */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <h3 className="text-[16px] font-semibold text-[#0E3470] mb-3">{t('annualWaterfall')}</h3>
        {([
          { label: t('noi'), value: inputs.noi, positive: true },
          // CapEx is always shown; when unset (=0), we display "Calculated at
          // Closing*" in place of a dollar amount so investors know reserves
          // are still pending rather than truly zero.
          metrics.capex > 0
            ? { label: t('capexReserves'), value: -metrics.capex }
            : { label: t('capexReserves'), value: 0, displayText: 'Calculated at Closing*' },
          {
            label: metrics.ioPeriodMonths > 0 ? t('seniorDebtServiceIO') + '*' : t('seniorDebtService'),
            value: -metrics.headlineSeniorDS,
          },
          ...(metrics.mezzAmount > 0 ? [{ label: t('mezzIoPayment'), value: -metrics.annualMezzPayment }] : []),
          ...(inputs.assetMgmtFee > 0 ? [{ label: t('assetManagementFee'), value: -metrics.assetMgmtFeeDollar }] : []),
        ] as Array<{ label: string; value: number; positive?: boolean; displayText?: string }>).map((row, i) => (
          <div key={i} className={`flex justify-between items-center py-2 px-3 ${i % 2 === 0 ? 'bg-[#F7F8FA]' : 'bg-white'} rounded`}>
            <span className={`text-[14px] ${row.positive ? 'text-[#374151] font-medium' : 'text-[#6B7280]'}`}>
              {!row.positive && '−  '}{row.label}
            </span>
            {row.displayText ? (
              <span className="text-[13px] font-medium text-[#6B7280] italic">{row.displayText}</span>
            ) : (
              <span className={`text-[15px] font-semibold tabular-nums text-right ${row.positive ? 'text-[#0E3470]' : 'text-[#DC2626]/80'}`}>
                {fmtFull(Math.abs(row.value))}
              </span>
            )}
          </div>
        ))}
        <div className="flex justify-between items-center py-2.5 px-3 mt-1 border-t-2 border-[#0E3470] bg-[#F7F8FA] rounded-b">
          <span className="text-[14px] font-bold text-[#374151]">{t('distributableCashFlow')}</span>
          <span className={`text-[16px] font-bold tabular-nums ${metrics.distributableCashFlow >= 0 ? 'text-[#0B8A4D]' : 'text-[#DC2626]'}`}>
            {fmtFull(metrics.distributableCashFlow)}
          </span>
        </div>
        {metrics.ioPeriodMonths > 0 && (
          <p className="mt-3 text-[11px] text-[#9CA3AF] leading-relaxed italic">
            {t('ioFootnote', { months: metrics.ioPeriodMonths, piAmount: fmtFull(metrics.annualSeniorDS) })}
          </p>
        )}
        {metrics.capex === 0 && (
          <p className="mt-3 text-[11px] text-[#9CA3AF] leading-relaxed italic">
            * CapEx reserves will be determined during due diligence and reflected in final offering terms.
          </p>
        )}
      </div>

      {/* Financing Detail — 3 Blocks */}
      <div className="space-y-3">
        {/* Block 1: Senior Debt */}
        <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-sm bg-[#0E3470]" />
            <h4 className="text-[15px] font-semibold text-[#0E3470]">{t('seniorDebt')}</h4>
            {isEstimated && <span className="text-[14px] font-medium text-[#BC9C45]">— {t('estimated')}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-1">
            {([
              [t('loanAmount'), fmtFull(metrics.loanAmount)],
              [t('ltv'), pct(inputs.ltv)],
              [t('interestRate'), pct(inputs.interestRate, 2)],
              [t('amortization'), `${inputs.amortYears} ${t('years')}`],
              ...(metrics.ioPeriodMonths > 0
                ? [
                    [t('ioPeriod'), `${metrics.ioPeriodMonths} ${t('months')}`],
                    [t('annualDebtServiceIO'), fmtFull(metrics.annualIODS)],
                    [t('annualDebtServicePI'), fmtFull(metrics.annualSeniorDS)],
                  ]
                : [[t('annualDebtService'), fmtFull(metrics.annualSeniorDS)]]),
              [t('loanOrigination'), `${inputs.loanFeePoints} ${t('points')} (${fmtFull(metrics.loanFeeDollar)})`],
              [
                inputs.sellerFinancing
                  ? (metrics.ioPeriodMonths > 0 ? `${t('lenderDscr')} (IO)` : t('lenderDscr'))
                  : (metrics.ioPeriodMonths > 0 ? t('dscrIO') : t('dscr')),
                metrics.lenderDSCR.toFixed(2) + 'x',
              ],
            ] as Array<[string, string]>).map(([l, v], i) => (
              <div key={i} className="flex justify-between items-baseline gap-3 py-1.5 border-b border-[#EEF0F4] last:border-b-0">
                <span className="text-[13px] text-[#6B7280]">{l}</span>
                <span className="text-[13px] font-semibold text-[#0E3470] tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Block 2: Seller Mezzanine */}
        {metrics.mezzAmount > 0 && (
          <div className="bg-white rounded-xl border border-[#BC9C45]/20 p-4 rp-card-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-sm bg-[#BC9C45]" />
              <h4 className="text-[15px] font-semibold text-[#BC9C45]">{t('sellerMezzanine')}</h4>
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
                <div key={i} className="flex justify-between items-baseline gap-3 py-1.5 border-b border-[#EEF0F4] last:border-b-0">
                  <span className="text-[13px] text-[#6B7280]">{l}</span>
                  <span className="text-[13px] font-semibold text-[#BC9C45] tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Block 3: Combined Metrics */}
        <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-[15px] font-semibold text-[#374151]">{t('combinedMetrics')}</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-1">
            {[
              [metrics.mezzAmount > 0 ? t('combinedDscr') : t('lenderDscr'), metrics.combinedDSCR.toFixed(2) + 'x'],
              [t('totalLeverage'), pct(metrics.totalLeverage)],
              [t('totalAnnualDebtObligations'), fmtFull(metrics.headlineSeniorDS + metrics.annualMezzPayment)],
            ].map(([l, v], i) => (
              <div key={i} className="flex justify-between items-baseline gap-3 py-1.5 border-b border-[#EEF0F4] last:border-b-0">
                <span className="text-[13px] text-[#6B7280]">{l}</span>
                <span className="text-[13px] font-bold text-[#0E3470] tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Return Comparison (mezz only) */}
      {traditional && (
        <ReturnComparison inputs={inputs} metrics={metrics} traditional={traditional} />
      )}

      {/* Fee Disclosure — prefers the resolved REPRIME fee terms
          (per-deal override or global default); falls back to `inputs.*Fee`
          for backward compatibility. Dollars computed inline, independent
          of headline metrics (which zero fees). */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
        <h4 className="text-[15px] font-semibold text-[#0E3470] mb-2">{t('feeDisclosure')}</h4>
        <div className="grid grid-cols-2 gap-x-4 md:gap-x-6 gap-y-1">
          {(() => {
            const assignment = feeDisclosure?.assignmentFee ?? inputs.assignmentFee;
            const acq = feeDisclosure?.acqFee ?? inputs.acqFee;
            const amf = feeDisclosure?.assetMgmtFee ?? inputs.assetMgmtFee;
            const carry = feeDisclosure?.gpCarry ?? inputs.gpCarry;
            const pref = feeDisclosure?.prefReturn ?? inputs.prefReturn;
            return [
              [`${t('assignmentFee')} (${pct(assignment)})`, fmtFull(inputs.purchasePrice * assignment / 100)],
              [`${t('acquisitionFee')} (${pct(acq)})`, fmtFull(inputs.purchasePrice * acq / 100)],
              [`${t('assetMgmtFee')} (${pct(amf)}${t('yr')})`, fmtFull(inputs.noi * amf / 100) + t('yr')],
              [t('gpCarry'), `${pct(carry, 0)} ${t('above')} ${pct(pref, 0)} ${t('pref')}`],
              [`${t('loanOrigination')} (${inputs.loanFeePoints} ${t('points')})`, fmtFull(metrics.loanAmount * inputs.loanFeePoints / 100)],
            ];
          })().map(([l, v], i) => (
            <div key={i} className="flex justify-between py-1 border-b border-[#EEF0F4] last:border-b-0">
              <span className="text-[12px] text-[#6B7280]">{l}</span>
              <span className="text-[12px] font-medium text-[#374151] tabular-nums">{v}</span>
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
  const fullyFinanced = metrics.netEquity <= 0;
  const rawSeniorPct = nb > 0 ? (metrics.loanAmount / nb) * 100 : 0;
  const rawMezzPct = nb > 0 && metrics.mezzAmount > 0 ? (metrics.mezzAmount / nb) * 100 : 0;
  const equityGapPct = nb > 0 ? ((nb - metrics.loanAmount - metrics.mezzAmount) / nb) * 100 : 0;
  // When over-leveraged, rescale Senior+Mezz widths so the bar still fills 100%.
  // Labels keep the real % of net basis (which may sum to >100%).
  const debtSum = rawSeniorPct + rawMezzPct;
  const seniorWidth = fullyFinanced && debtSum > 0 ? (rawSeniorPct / debtSum) * 100 : rawSeniorPct;
  const mezzWidth = fullyFinanced && debtSum > 0 ? (rawMezzPct / debtSum) * 100 : rawMezzPct;
  const totalCapital = fullyFinanced
    ? nb + metrics.closingCosts
    : metrics.loanAmount + metrics.mezzAmount + metrics.netEquity;

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
      <h4 className="text-[15px] font-semibold text-[#0E3470] mb-3">{t('capitalStack')}</h4>
      {/* Bar segments based on Net Basis (LTV structure) */}
      <div className="h-9 rounded-lg overflow-hidden flex mb-3">
        {seniorWidth > 0 && (
          <div className="flex items-center justify-center text-white text-[10px] font-bold whitespace-nowrap px-1" style={{ width: `${seniorWidth}%`, backgroundColor: '#0E3470' }}>
            {t('senior')} {Math.round(rawSeniorPct)}%
          </div>
        )}
        {mezzWidth > 0 && (
          <div className="flex items-center justify-center text-white text-[10px] font-bold whitespace-nowrap px-1" style={{ width: `${mezzWidth}%`, backgroundColor: '#BC9C45', minWidth: '70px' }}>
            {t('mezz')} {Math.round(rawMezzPct)}%
          </div>
        )}
        {!fullyFinanced && equityGapPct > 0 && (
          <div className="flex items-center justify-center text-white text-[10px] font-bold whitespace-nowrap px-1" style={{ width: `${equityGapPct}%`, backgroundColor: '#0B8A4D', minWidth: '70px' }}>
            {t('equity')} {Math.round(equityGapPct)}%
          </div>
        )}
      </div>
      {fullyFinanced && (
        <div className="mb-3 text-[11px] font-semibold text-[#0B8A4D]">
          {t('fullyFinanced')}
        </div>
      )}
      {/* Dollar amounts */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center py-1.5 border-b border-[#EEF0F4]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#0E3470]" />
            <span className="text-[13px] text-[#374151]">{t('seniorDebt')}</span>
            {isEstimated && <span className="text-[8px] text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-full font-semibold">{t('est')}</span>}
          </div>
          <span className="text-[14px] font-bold text-[#0E3470] tabular-nums">{fmtFull(metrics.loanAmount)}</span>
        </div>
        {metrics.mezzAmount > 0 && (
          <div className="flex justify-between items-center py-1.5 border-b border-[#EEF0F4]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-[#BC9C45]" />
              <span className="text-[13px] text-[#374151]">{t('sellerMezzanine')}</span>
            </div>
            <span className="text-[14px] font-bold text-[#BC9C45] tabular-nums">{fmtFull(metrics.mezzAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center py-1.5 border-b border-[#EEF0F4]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#0B8A4D]" />
            <span className="text-[13px] text-[#374151]">{t('investorEquity')}</span>
          </div>
          <span className="text-[14px] font-bold text-[#0B8A4D] tabular-nums">{fullyFinanced ? '$0' : fmtFull(metrics.netEquity)}</span>
        </div>
      </div>
      {/* Summary lines */}
      <div className="mt-3 pt-3 border-t border-[#EEF0F4] space-y-1">
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-[#6B7280]">{tp('purchasePrice')}</span>
          <span className="font-semibold text-[#0E3470] tabular-nums">{fmtFull(pp)}</span>
        </div>
        {inputs.sellerCredit > 0 && (
          <>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-[#6B7280]">{'\u2212'} {t('sellerCreditAtClosing')}</span>
              <span className="font-semibold text-[#DC2626]/80 tabular-nums">({fmtFull(inputs.sellerCredit)})</span>
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-[#6B7280]">{t('netBasis')}</span>
              <span className="font-semibold text-[#0E3470] tabular-nums">{fmtFull(nb)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-[#6B7280]">+ {metrics.closingCosts === 0 ? t('estClosingCosts') : t('closingCosts')}</span>
          <span className="font-semibold text-[#0E3470] tabular-nums">{metrics.closingCosts === 0 ? 'TBD*' : fmtFull(metrics.closingCosts)}</span>
        </div>
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-[#6B7280]">{t('totalCapitalRequired')}</span>
          <span className="font-bold text-[#0E3470] tabular-nums">{fmtFull(totalCapital)}{metrics.closingCosts === 0 ? '+' : ''}</span>
        </div>
        {metrics.closingCosts === 0 && (
          <p className="text-[11px] text-[#9CA3AF] leading-relaxed pt-1">
            {t('closingCostsFootnote')}
          </p>
        )}
        {fullyFinanced && (
          <>
            <div className="mt-2 pt-2 border-t border-[#EEF0F4]" />
            <div className="text-[10px] font-bold text-[#6B7280] uppercase tracking-[1.5px]">
              {t('fundedBy')}
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-[#6B7280]">{t('seniorDebt')} ({Math.round(rawSeniorPct)}%)</span>
              <span className="font-semibold text-[#0E3470] tabular-nums">{fmtFull(metrics.loanAmount)}</span>
            </div>
            {metrics.mezzAmount > 0 && (
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#6B7280]">{t('sellerMezzanine')} ({Math.round(rawMezzPct)}%)</span>
                <span className="font-semibold text-[#BC9C45] tabular-nums">{fmtFull(metrics.mezzAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-[#6B7280]">{t('totalFinancing')}</span>
              <span className="font-semibold text-[#0E3470] tabular-nums">{fmtFull(metrics.loanAmount + metrics.mezzAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-[#6B7280]">{t('investorEquity')}</span>
              <span className="font-bold text-[#0B8A4D] tabular-nums">$0</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED: Return Comparison Table
// ═══════════════════════════════════════════════════════════
function ReturnComparison({ inputs, metrics, traditional }: { inputs: DealInputs; metrics: DealMetrics; traditional: DealMetrics }) {
  const t = useTranslations('portal.financial');
  const mFullyFinanced = metrics.netEquity <= 0;
  const mHasPositiveCF = metrics.distributableCashFlow > 0;
  const mInf = mFullyFinanced ? (mHasPositiveCF ? '∞' : 'N/A') : null;
  const mCoC = mInf ?? (metrics.cocReturn !== null ? pct(metrics.cocReturn, 2) : 'N/A');
  const mIRR = mInf ?? (metrics.irr !== null ? pct(metrics.irr, 2) : 'N/A');
  const mEquity = mFullyFinanced ? '$0' : fmtFull(metrics.netEquity);
  const tCoC = traditional.cocReturn !== null ? pct(traditional.cocReturn, 2) : 'N/A';
  const tIRR = traditional.irr !== null ? pct(traditional.irr, 2) : 'N/A';
  const rows = [
    { label: t('seniorDebt'), t: fmtFull(traditional.loanAmount), m: fmtFull(metrics.loanAmount) },
    { label: t('sellerMezz'), t: '—', m: `${fmtFull(metrics.mezzAmount)} ${t('at')} ${pct(inputs.mezzRate)} ${t('io')}` },
    { label: t('investorEquity'), t: fmtFull(traditional.netEquity), m: mEquity },
    { label: t('annualCashFlow'), t: fmtFull(traditional.distributableCashFlow), m: fmtFull(metrics.distributableCashFlow) },
    { label: t('cocReturn'), t: tCoC, m: mCoC, bold: true, greenIfBetter: mFullyFinanced || ((metrics.cocReturn ?? 0) - (traditional.cocReturn ?? 0) > 2) },
    { label: `${t('irr')} (${inputs.holdPeriodYears}yr)`, t: tIRR, m: mIRR, bold: true, greenIfBetter: mFullyFinanced || ((metrics.irr ?? 0) - (traditional.irr ?? 0) > 2) },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
      <h4 className="text-[15px] font-semibold text-[#0E3470] mb-3">{t('returnComparison')}</h4>
      <div className="grid grid-cols-3 gap-0 rounded-lg overflow-hidden border border-[#EEF0F4]">
        <div className="p-2.5 bg-[#F7F8FA]" />
        <div className="p-2.5 bg-[#F7F8FA] text-center border-l border-[#EEF0F4]">
          <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-[1.5px]">{t('traditionalClose')}</span>
        </div>
        <div className="p-2.5 text-center border-l border-[#EEF0F4]" style={{ backgroundColor: 'rgba(188,156,69,0.08)' }}>
          <span className="text-[11px] font-bold text-[#BC9C45] uppercase tracking-[1.5px]">{t('withSellerMezz')}</span>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="contents">
            <div className="p-2.5 border-t border-[#EEF0F4] flex items-center bg-[#F7F8FA]">
              <span className="text-[13px] font-medium text-[#6B7280]">{row.label}</span>
            </div>
            <div className="p-2.5 border-t border-l border-[#EEF0F4] text-center">
              <span className="text-[13px] text-[#374151] tabular-nums">{row.t}</span>
            </div>
            <div className={`p-2.5 border-t border-l border-[#EEF0F4] text-center ${row.greenIfBetter ? 'bg-[#ECFDF5]' : ''}`} style={{ backgroundColor: row.greenIfBetter ? undefined : 'rgba(188,156,69,0.04)' }}>
              <span className={`text-[13px] tabular-nums ${row.bold ? 'font-bold' : 'font-semibold'} ${row.greenIfBetter ? 'text-[#0B8A4D]' : 'text-[#0E3470]'}`}>{row.m}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Default export for backward compatibility
export default function FinancialOverview({ deal }: { deal: Record<string, unknown> }) {
  const { parseDealInputs: parse, calculatePropertyMetrics: calcProp, calculateTraditionalClose: calcTrad } = require('@/lib/utils/deal-calculator');
  const inputs = parse(deal);
  const metrics = calcProp(inputs);
  const traditional = inputs.sellerFinancing ? calcTrad(inputs) : null;
  return <DealStructureFinancials inputs={inputs} metrics={metrics} traditional={traditional} isEstimated={!deal.debt_terms_quoted} />;
}
