'use client';

import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/utils/format';
import type { FeeDefaults } from '@/lib/utils/fee-resolver';

export type CommitStructure = 'assignment' | 'gplp';

interface Props {
  open: boolean;
  structure: CommitStructure;
  fees: FeeDefaults;
  purchasePrice: number;
  equityRequired: number;
  /** Fee-adjusted IRR that the investor would realize under this structure. */
  projectedIRR: number | null;
  /** Fee-adjusted CoC return. null for "no equity" (fully financed). */
  projectedCoC: number | null;
  acqFeeDollar: number;
  assetMgmtFeeDollarPerYear: number;
  fullyFinanced: boolean;
  hasPositiveCashFlow: boolean;
  previewMode?: boolean;
  onCancel: () => void;
  onCommit: () => void;
}

function fmtPct(v: number): string {
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(2).replace(/\.?0+$/, '')}%`;
}

function fmtDollars(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function StructureCommitModal({
  open,
  structure,
  fees,
  purchasePrice,
  equityRequired,
  projectedIRR,
  projectedCoC,
  acqFeeDollar,
  assetMgmtFeeDollarPerYear,
  fullyFinanced,
  hasPositiveCashFlow,
  previewMode = false,
  onCancel,
  onCommit,
}: Props) {
  const t = useTranslations('portal.dealDetail');

  if (!open) return null;

  const inf = fullyFinanced ? (hasPositiveCashFlow ? '∞' : 'N/A') : null;

  const title =
    structure === 'assignment'
      ? t('assignmentStructureTitle')
      : t('gplpStructureTitle');

  const description =
    structure === 'assignment'
      ? t('assignmentStructureDesc')
      : t('gplpStructureDesc');

  const termsRows =
    structure === 'assignment'
      ? [
          { label: t('assignmentFee'), value: fmtPct(fees.assignmentFee) },
          {
            label: t('feeAmount'),
            value: fmtDollars(purchasePrice * (fees.assignmentFee / 100)),
          },
        ]
      : [
          {
            label: t('acquisitionFee'),
            value: `${fmtPct(fees.acqFee)} (${fmtDollars(acqFeeDollar)})`,
          },
          {
            label: t('assetMgmtFee'),
            value: `${fmtPct(fees.assetMgmtFee)}/yr (${fmtDollars(assetMgmtFeeDollarPerYear)}/yr)`,
          },
          {
            label: t('gpCarry'),
            value: `${fmtPct(fees.gpCarry)} above ${fmtPct(fees.prefReturn)} pref`,
          },
          { label: t('preferredReturn'), value: fmtPct(fees.prefReturn) },
        ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E3470]/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_24px_80px_rgba(14,52,112,0.25)]">
        <div className="px-6 pt-6 pb-4">
          <div className="text-[10px] font-bold tracking-[2px] uppercase text-[#BC9C45] mb-1">
            {structure === 'assignment' ? t('optionA') : t('optionB')}
          </div>
          <h3 className="font-[family-name:var(--font-playfair)] text-[22px] font-semibold text-[#0E3470]">
            {title}
          </h3>
        </div>

        <div className="px-6 pb-5 space-y-4">
          {/* Terms block */}
          <div className="space-y-2">
            {termsRows.map((row) => (
              <div
                key={row.label}
                className="flex justify-between py-2 border-b border-[#EEF0F4] last:border-b-0"
              >
                <span className="text-[12px] text-[#6B7280]">{row.label}</span>
                <span className="text-[13px] font-semibold text-[#0E3470] tabular-nums">
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#EEF0F4]" />

          {/* Deal-level figures */}
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-[#EEF0F4]">
              <span className="text-[12px] text-[#6B7280]">{t('purchasePrice')}</span>
              <span className="text-[13px] font-semibold text-[#0E3470] tabular-nums">
                {fmtDollars(purchasePrice)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#EEF0F4]">
              <span className="text-[12px] text-[#6B7280]">{t('yourEquityRequired')}</span>
              <span
                className={`text-[13px] font-semibold tabular-nums ${fullyFinanced ? 'text-[#0B8A4D]' : 'text-[#0E3470]'}`}
              >
                {fullyFinanced ? '$0' : fmtDollars(equityRequired)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#EEF0F4]">
              <span className="text-[12px] text-[#6B7280]">{t('projectedIrr')}</span>
              <span
                className={`text-[13px] font-semibold tabular-nums ${fullyFinanced ? 'text-[#0B8A4D]' : 'text-[#0E3470]'}`}
              >
                {inf ?? (projectedIRR !== null ? `${projectedIRR.toFixed(2)}%` : '--')}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[12px] text-[#6B7280]">{t('projectedCoc')}</span>
              <span
                className={`text-[13px] font-semibold tabular-nums ${fullyFinanced ? 'text-[#0B8A4D]' : 'text-[#0E3470]'}`}
              >
                {inf ?? (projectedCoC !== null ? `${projectedCoC.toFixed(2)}%` : '--')}
              </span>
            </div>
          </div>

          <div className="border-t border-[#EEF0F4]" />

          <p className="text-[12px] leading-[1.6] text-[#6B7280]">{description}</p>
        </div>

        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#EEF0F4] rounded-b-2xl flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-[#6B7280] hover:bg-white transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onCommit}
            disabled={previewMode}
            title={previewMode ? 'Preview mode — read-only' : undefined}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[13px] font-bold shadow-[0_4px_16px_rgba(188,156,69,0.3)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('commitToDeal')}
          </button>
        </div>
      </div>
    </div>
  );
}
