'use client';

import { useTranslations } from 'next-intl';
import FadeInOnScroll from '@/components/ui/FadeInOnScroll';
import { DealStructureFinancials } from '@/components/portal/FinancialOverview';
import { formatPrice } from '@/lib/utils/format';
import type { DealWithDetails } from '@/lib/types/database';
import type { FeeDefaults } from '@/lib/utils/fee-resolver';
import { type DealInputs, calculatePropertyMetrics, calculateDeal, calculateTraditionalClose } from '@/lib/utils/deal-calculator';
import { buildIrrAssumptions } from './MetricCard';
import { IRRCalculatorPanel } from './IRRCalculatorPanel';
import type { CommitStructure } from '@/components/portal/StructureCommitModal';

interface FinancialProps {
  inputs: DealInputs;
  metrics: ReturnType<typeof calculatePropertyMetrics>;
  traditional: ReturnType<typeof calculateTraditionalClose> | null;
  isEstimated: boolean;
  feeDisclosure: FeeDefaults;
}

interface Props {
  deal: DealWithDetails;
  financialProps: FinancialProps;
  computed: ReturnType<typeof calculatePropertyMetrics>;
  feeAdjustedMetrics: ReturnType<typeof calculateDeal>;
  feeAdjustedInputs: DealInputs;
  effectiveDealFees: FeeDefaults;
  effectiveInvestorTerms: FeeDefaults;
  selectedStructure: 'assignment' | 'gplp';
  setSelectedStructure: (s: 'assignment' | 'gplp') => void;
  setStructureModal: (s: CommitStructure | null) => void;
  setStructurePhoneError: (e: string | null) => void;
  onSliderChange: () => void;
}

const formatFeePct = (v: number): string =>
  Number.isInteger(v) ? `${v}%` : `${v.toFixed(2).replace(/\.?0+$/, '')}%`;

export function DealStructureTab({
  deal,
  financialProps,
  computed,
  feeAdjustedMetrics,
  feeAdjustedInputs,
  effectiveDealFees,
  effectiveInvestorTerms,
  selectedStructure,
  setSelectedStructure,
  setStructureModal,
  setStructurePhoneError,
  onSliderChange,
}: Props) {
  const t = useTranslations('portal.dealDetail');

  return (
    <div className="mt-4 md:mt-5 px-4 md:px-8 pb-6 md:pb-8">
      <DealStructureFinancials {...financialProps} />

      {deal.special_terms && deal.special_terms !== 'None' && (
        <FadeInOnScroll delay={0.05}>
          <div className="mt-6 bg-[#FDF8ED] border-l-4 border-[#BC9C45] p-4 rounded-r-lg">
            <div className="text-[12px] font-semibold text-[#BC9C45] uppercase tracking-wider mb-1">
              {t('specialTerms')}
            </div>
            <p className="text-[15px] text-[#4B5563]">{deal.special_terms}</p>
          </div>
        </FadeInOnScroll>
      )}

      <div className="mt-6" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <FadeInOnScroll delay={0}>
          <button
            onClick={() => {
              setSelectedStructure('assignment');
              setStructurePhoneError(null);
              setStructureModal('assignment');
            }}
            className={`w-full h-full bg-white rounded-xl border-2 p-5 text-left cursor-pointer transition-all relative flex flex-col ${
              selectedStructure === 'assignment'
                ? 'border-[#BC9C45] shadow-[0_0_0_3px_#FDF8ED,0_0_20px_rgba(188,156,69,0.15)]'
                : 'border-[#EEF0F4] hover:border-[#D1D5DB]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-[700] uppercase tracking-[2px] text-[#BC9C45]">
                {t('optionA')}
              </span>
              <span className="text-[32px] font-[800] text-[#BC9C45] leading-none">
                {formatFeePct(effectiveDealFees.assignmentFee)}
              </span>
            </div>
            <h3 className="font-[700] text-[#0E3470] text-[20px] mb-3">
              {t('assignment')}
            </h3>
            <p className="text-[15px] text-[#6B7280] mb-3">
              {t('assignmentDesc')}
            </p>
            <div className="mt-auto bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
              <div className="data-label !text-[#0B8A4D] mb-1">
                {t('projectedIrr')}
              </div>
              <div className="text-2xl font-bold text-[#0B8A4D]">
                {computed.netEquity <= 0
                  ? (computed.distributableCashFlow > 0 ? '∞' : 'N/A')
                  : (feeAdjustedMetrics.assignmentIRR !== null ? feeAdjustedMetrics.assignmentIRR.toFixed(2) + '%' : '--')}
              </div>
              {computed.netEquity > 0 && (
                <div className="text-[10px] text-[#9CA3AF] mt-1 leading-tight">
                  {buildIrrAssumptions(deal as unknown as { exit_cap_rate?: string | null; hold_period_years?: string | null; rent_growth?: string | null }, computed)}
                </div>
              )}
              <div className="text-[11px] text-[#6B7280] mt-1">
                {t('feeIncluded')}
              </div>
            </div>
          </button>
        </FadeInOnScroll>

        <FadeInOnScroll delay={0.1}>
          <button
            onClick={() => {
              setSelectedStructure('gplp');
              setStructurePhoneError(null);
              setStructureModal('gplp');
            }}
            className={`w-full h-full bg-white rounded-xl border-2 p-5 text-left cursor-pointer transition-all flex flex-col ${
              selectedStructure === 'gplp'
                ? 'border-[#BC9C45] shadow-[0_0_0_3px_#FDF8ED,0_0_20px_rgba(188,156,69,0.15)]'
                : 'border-[#EEF0F4] hover:border-[#D1D5DB]'
            }`}
          >
            <span className="text-[11px] font-[700] uppercase tracking-[2px] text-[#BC9C45] block mb-2">
              {t('optionB')}
            </span>
            <h3 className="font-[700] text-[#0E3470] text-[20px] mb-3">
              {t('gpLpPartnership')}
            </h3>
            <div className="space-y-1.5 mb-3">
              {[
                { label: t('acquisitionFee'), value: `${formatFeePct(effectiveDealFees.acqFee)} ($${Math.round(feeAdjustedMetrics.acqFeeDollar).toLocaleString()})` },
                { label: t('assetMgmtFee'), value: `${formatFeePct(effectiveDealFees.assetMgmtFee)} ($${Math.round(feeAdjustedMetrics.assetMgmtFeeDollar).toLocaleString()}/yr)` },
                { label: t('gpCarry'), value: `${formatFeePct(effectiveDealFees.gpCarry)} above ${formatFeePct(effectiveDealFees.prefReturn)} pref` },
                { label: t('equityRequired'), value: formatPrice(deal.equity_required) },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between py-1.5 border-b border-[#EEF0F4] last:border-b-0"
                >
                  <span className="data-label">
                    {row.label}
                  </span>
                  <span className="text-[15px] font-semibold text-[#0E3470]">
                    {row.value ?? '--'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-auto bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
              <div className="data-label !text-[#0B8A4D] mb-1">
                {t('projectedIrr')}
              </div>
              <div className="text-2xl font-bold text-[#0B8A4D]">
                {computed.netEquity <= 0
                  ? (computed.distributableCashFlow > 0 ? '∞' : 'N/A')
                  : (feeAdjustedMetrics.irr !== null ? feeAdjustedMetrics.irr.toFixed(2) + '%' : '--')}
              </div>
              {computed.netEquity > 0 && (
                <div className="text-[10px] text-[#9CA3AF] mt-1 leading-tight">
                  {buildIrrAssumptions(deal as unknown as { exit_cap_rate?: string | null; hold_period_years?: string | null; rent_growth?: string | null }, computed)}
                </div>
              )}
              <div className="text-[11px] text-[#6B7280] mt-1">
                {t('allFeesIncludedShort')}
              </div>
            </div>
          </button>
        </FadeInOnScroll>
      </div>

      <FadeInOnScroll delay={0.2}>
        <div className="mt-6">
          <IRRCalculatorPanel
            deal={deal}
            baseIRR={feeAdjustedMetrics.irr ?? 0}
            assignmentIRRProp={feeAdjustedMetrics.assignmentIRR}
            acqFeeDollar={feeAdjustedMetrics.acqFeeDollar}
            assetMgmtFeeDollar={feeAdjustedMetrics.assetMgmtFeeDollar}
            onSliderChange={onSliderChange}
            fullyFinanced={computed.netEquity <= 0}
            hasPositiveCashFlow={computed.distributableCashFlow > 0}
            effectiveFees={effectiveDealFees}
            customStartingFees={effectiveInvestorTerms}
            feeAdjustedInputs={feeAdjustedInputs}
          />
        </div>
      </FadeInOnScroll>
    </div>
  );
}
