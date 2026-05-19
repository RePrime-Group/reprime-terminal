'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { calculateDeal, type DealInputs } from '@/lib/utils/deal-calculator';
import { formatPrice } from '@/lib/utils/format';
import { type FeeDefaults } from '@/lib/utils/fee-resolver';
import type { DealWithDetails } from '@/lib/types/database';
import type { CalculatorMode } from './types';

export function IRRCalculatorPanel({
  deal,
  baseIRR: baseIRRProp,
  assignmentIRRProp,
  acqFeeDollar,
  assetMgmtFeeDollar,
  onSliderChange,
  fullyFinanced = false,
  hasPositiveCashFlow = true,
  effectiveFees,
  customStartingFees,
  feeAdjustedInputs,
}: {
  deal: DealWithDetails;
  baseIRR: number;
  assignmentIRRProp: number | null;
  acqFeeDollar: number;
  assetMgmtFeeDollar: number;
  onSliderChange: () => void;
  fullyFinanced?: boolean;
  hasPositiveCashFlow?: boolean;
  effectiveFees: FeeDefaults;
  customStartingFees: FeeDefaults;
  feeAdjustedInputs: DealInputs;
}) {
  const t = useTranslations('portal.dealDetail');
  const ts = useTranslations('portal.structure');
  const [mode, setMode] = useState<CalculatorMode>('assignment');
  const fmtPct = (v: number): string =>
    Number.isInteger(v) ? `${v}%` : `${v.toFixed(2).replace(/\.?0+$/, '')}%`;

  const [customAssignmentFee, setCustomAssignmentFee] = useState(customStartingFees.assignmentFee);
  const [customAcqFee, setCustomAcqFee] = useState(customStartingFees.acqFee);
  const [customAssetMgmtFee, setCustomAssetMgmtFee] = useState(customStartingFees.assetMgmtFee);
  const [customGpCarry, setCustomGpCarry] = useState(customStartingFees.gpCarry);
  const [customPrefReturn, setCustomPrefReturn] = useState(customStartingFees.prefReturn);

  const customMetrics = useMemo(
    () =>
      calculateDeal({
        ...feeAdjustedInputs,
        assignmentFee: customAssignmentFee,
        acqFee: customAcqFee,
        assetMgmtFee: customAssetMgmtFee,
        gpCarry: customGpCarry,
        prefReturn: customPrefReturn,
      }),
    [feeAdjustedInputs, customAssignmentFee, customAcqFee, customAssetMgmtFee, customGpCarry, customPrefReturn],
  );
  const customIRR = customMetrics.irr ?? 0;

  const infReturn = fullyFinanced ? (hasPositiveCashFlow ? '∞' : 'N/A') : null;

  const handleSliderChange = (setter: (v: number) => void, value: number) => {
    setter(value);
    onSliderChange();
  };

  const modes: { key: CalculatorMode; label: string }[] = [
    { key: 'assignment', label: ts('assignment') },
    { key: 'gplp', label: t('gpLp') },
    { key: 'custom', label: ts('customTerms') },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#EEF0F4] rp-card-shadow">
      <div className="data-label !text-[#BC9C45] !tracking-[2px] mb-4">
        {t('returnsCalc')}
      </div>

      <div className="inline-flex rounded-lg bg-[#F7F8FA] p-1 mb-6">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === m.key
                ? 'bg-[#0E3470] text-white'
                : 'text-[#6B7280] hover:text-[#0E3470]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'assignment' && (
        <div>
          <div className="mb-4">
            <div className="text-[#9CA3AF] text-xs mb-1">{t('assignmentFee')}</div>
            <div className="text-xl font-bold text-[#0E3470]">{fmtPct(effectiveFees.assignmentFee)}</div>
          </div>
          <div className="mb-4">
            <div className="text-[#9CA3AF] text-xs mb-1">{t('projectedIrr')}</div>
            <div className="text-[52px] font-[800] text-[#0B8A4D] leading-none">
              {infReturn ?? (assignmentIRRProp !== null ? assignmentIRRProp.toFixed(2) + '%' : '--')}
            </div>
          </div>
          <div className="text-xs text-[#9CA3AF] mt-2">
            {t('feeBreakdownIncluded')}
          </div>
        </div>
      )}

      {mode === 'gplp' && (
        <div>
          <div className="space-y-2 mb-4">
            {[
              { label: t('acquisitionFee'), value: `${fmtPct(effectiveFees.acqFee)} ($${Math.round(acqFeeDollar).toLocaleString()})` },
              { label: t('assetMgmtFee'), value: `${fmtPct(effectiveFees.assetMgmtFee)} ($${Math.round(assetMgmtFeeDollar).toLocaleString()}/yr)` },
              { label: t('gpCarry'), value: `${fmtPct(effectiveFees.gpCarry)} above ${fmtPct(effectiveFees.prefReturn)} pref` },
              { label: t('equityRequired'), value: formatPrice(deal.equity_required) },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-[#9CA3AF]">{row.label}</span>
                <span className="font-semibold text-[#0E3470]">{row.value ?? '--'}</span>
              </div>
            ))}
          </div>
          <div className="mb-4">
            <div className="text-[#9CA3AF] text-xs mb-1">{t('projectedIrr')}</div>
            <div className="text-[52px] font-[800] text-[#0B8A4D] leading-none">
              {infReturn ?? (baseIRRProp > 0 ? baseIRRProp.toFixed(2) + '%' : '--')}
            </div>
          </div>
        </div>
      )}

      {mode === 'custom' && (
        <div>
          <div className="space-y-5 mb-6">
            {([
              { label: t('assignmentFee'), value: customAssignmentFee, setValue: setCustomAssignmentFee, min: 0, max: 6, step: 0.25 },
              { label: t('acquisitionFee'), value: customAcqFee, setValue: setCustomAcqFee, min: 0, max: 5, step: 0.25 },
              { label: t('assetMgmtFee'), value: customAssetMgmtFee, setValue: setCustomAssetMgmtFee, min: 0, max: 3, step: 0.25 },
              { label: t('gpCarry'), value: customGpCarry, setValue: setCustomGpCarry, min: 0, max: 35, step: 1 },
              { label: t('preferredReturn'), value: customPrefReturn, setValue: setCustomPrefReturn, min: 0, max: 12, step: 0.5 },
            ] as const).map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-[#6B7280]">{s.label}</span>
                  <span className="font-semibold text-[#0E3470]">{fmtPct(s.value)}</span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.value}
                  onChange={(e) => handleSliderChange(s.setValue, Number(e.target.value))}
                  className="w-full h-1.5"
                  style={{ accentColor: '#BC9C45' }}
                />
                <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-1">
                  <span>{fmtPct(s.min)}</span>
                  <span>{fmtPct(s.max)}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="text-[#9CA3AF] text-xs mb-1">{t('calculatedIrr')}</div>
            <div className="text-[52px] font-[800] text-[#0B8A4D] leading-none">
              {infReturn ?? `${customIRR.toFixed(2)}%`}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[#EEF0F4] text-xs text-[#9CA3AF]">
        {t('allFeesIncluded')}
      </div>
    </div>
  );
}
