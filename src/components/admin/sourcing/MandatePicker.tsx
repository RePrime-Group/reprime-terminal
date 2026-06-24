'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { MatchRequest } from '@/lib/portal/types';
import type {
  SourcingInvestorOption,
  SourcingMandateOption,
} from './SourcingPageClient';

interface Props {
  investors: SourcingInvestorOption[];
  mandates: SourcingMandateOption[];
  selectedInvestorId: string | null;
  selectedMandateId: string | null;
  onInvestorChange: (id: string | null) => void;
  onMandateChange: (id: string | null) => void;
  translation: { criteria: MatchRequest } | null;
}

export default function MandatePicker({
  investors,
  mandates,
  selectedInvestorId,
  selectedMandateId,
  onInvestorChange,
  onMandateChange,
  translation,
}: Props) {
  const t = useTranslations('admin.sourcing');

  const mandatesForInvestor = useMemo(
    () => mandates.filter((m) => m.investorId === selectedInvestorId),
    [mandates, selectedInvestorId],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-rp-gray-600">
            {t('investorLabel')}
          </label>
          <select
            value={selectedInvestorId ?? ''}
            onChange={(e) => onInvestorChange(e.target.value || null)}
            className="px-3 py-2 rounded-lg border border-rp-gray-200 bg-white text-sm text-rp-navy focus:outline-none focus:border-rp-gold"
          >
            <option value="">{t('selectInvestor')}</option>
            {investors.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.label}
                {inv.company ? ` — ${inv.company}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-semibold text-rp-gray-600">
            {t('mandateLabel')}
          </label>
          <select
            value={selectedMandateId ?? ''}
            onChange={(e) => onMandateChange(e.target.value || null)}
            disabled={!selectedInvestorId}
            className="px-3 py-2 rounded-lg border border-rp-gray-200 bg-white text-sm text-rp-navy focus:outline-none focus:border-rp-gold disabled:bg-rp-gray-100 disabled:text-rp-gray-400"
          >
            <option value="">{t('selectMandate')}</option>
            {mandatesForInvestor.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* What we'll search for — a glance at the translated criteria. */}
      {translation && selectedMandateId && (
        <TranslatedCriteriaPreview criteria={translation.criteria} />
      )}
    </div>
  );
}

function TranslatedCriteriaPreview({ criteria }: { criteria: MatchRequest }) {
  const t = useTranslations('admin.sourcing');
  const chips: string[] = [];
  if (criteria.min_price != null || criteria.max_price != null) {
    chips.push(
      `${t('cPrice')}: ${fmtRange(criteria.min_price, criteria.max_price, formatMoney)}`,
    );
  }
  if (criteria.min_cap != null) chips.push(`${t('cCap')}: ≥ ${criteria.min_cap}%`);
  if (criteria.min_occupancy != null || criteria.max_occupancy != null) {
    chips.push(
      `${t('cOccupancy')}: ${fmtRange(criteria.min_occupancy, criteria.max_occupancy, (n) => `${n}%`)}`,
    );
  }
  if (criteria.min_sqft != null || criteria.max_sqft != null) {
    chips.push(
      `${t('cSqft')}: ${fmtRange(criteria.min_sqft, criteria.max_sqft, formatInt)} sf`,
    );
  }
  if (criteria.max_price_per_sf != null) chips.push(`${t('cPsf')}: ≤ $${criteria.max_price_per_sf}/sf`);
  if (criteria.property_types?.length) {
    chips.push(`${t('cPropertyTypes')}: ${criteria.property_types.join(', ')}`);
  }
  if (criteria.states?.length) chips.push(`${t('cStates')}: ${criteria.states.join(', ')}`);

  if (chips.length === 0) {
    return (
      <p className="text-[12px] text-rp-gray-500 italic">{t('noUsableCriteria')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-wide text-rp-gray-500 font-semibold">
        {t('willSearchFor')}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <span
            key={i}
            className="text-[12px] px-2 py-1 rounded-md bg-rp-gold-bg border border-rp-gold/20 text-rp-navy"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function fmtRange(min: number | undefined, max: number | undefined, f: (n: number) => string): string {
  if (min != null && max != null) return `${f(min)} – ${f(max)}`;
  if (min != null) return `≥ ${f(min)}`;
  if (max != null) return `≤ ${f(max)}`;
  return '—';
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}
