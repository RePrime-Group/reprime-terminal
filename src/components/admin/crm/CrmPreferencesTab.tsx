'use client';

import { useTranslations } from 'next-intl';
import type { CrmInvestmentPreferences } from '@/lib/types/database';
import { formatPrice } from '@/lib/utils/format';
import { PROPERTY_TYPE_LABEL, PRIORITY_LABEL, STRUCTURE_LABEL } from './CrmConstants';

function Chips({ items, labelMap }: { items?: string[]; labelMap?: Record<string, string> }) {
  if (!items || items.length === 0) return <span className="text-sm text-rp-gray-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span key={it} className="px-2.5 py-1 rounded-md bg-rp-gray-100 text-rp-gray-700 text-xs">
          {labelMap?.[it] ?? it}
        </span>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-rp-gray-200 last:border-b-0">
      <div className="text-[11px] font-semibold text-rp-gray-500 uppercase tracking-wider mb-1.5">{label}</div>
      {children}
    </div>
  );
}

export default function CrmPreferencesTab({ prefs }: { prefs: CrmInvestmentPreferences }) {
  const t = useTranslations('admin.crm');

  const hasAny =
    prefs &&
    Object.values(prefs).some((v) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined));

  if (!hasAny) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-rp-gray-200">
        <p className="text-sm text-rp-gray-500">{t('prefNone')}</p>
      </div>
    );
  }

  const checkSize =
    prefs.min_check_size || prefs.max_check_size
      ? `${prefs.min_check_size ? formatPrice(prefs.min_check_size) : '—'} — ${
          prefs.max_check_size ? formatPrice(prefs.max_check_size) : '—'
        }`
      : t('notSpecified');

  return (
    <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow px-4">
      <Row label={t('prefPropertyTypes')}>
        <Chips items={prefs.property_types} labelMap={PROPERTY_TYPE_LABEL} />
      </Row>
      <Row label={t('prefMarkets')}>
        <Chips items={prefs.markets} />
      </Row>
      <Row label={t('prefCheckSize')}>
        <span className="text-sm text-rp-gray-700 tabular-nums">{checkSize}</span>
      </Row>
      <Row label={t('prefPriority')}>
        <span className="text-sm text-rp-gray-700">
          {prefs.priority ? PRIORITY_LABEL[prefs.priority] ?? prefs.priority : t('notSpecified')}
        </span>
      </Row>
      <Row label={t('prefSellerMezz')}>
        {prefs.accepts_seller_mezz === true ? (
          <span className="text-sm font-medium text-rp-green">{t('yes')}</span>
        ) : prefs.accepts_seller_mezz === false ? (
          <span className="text-sm font-medium text-rp-red">{t('no')}</span>
        ) : (
          <span className="text-sm text-rp-gray-400">{t('notSpecified')}</span>
        )}
      </Row>
      <Row label={t('prefPreferredReturn')}>
        <span className="text-sm text-rp-gray-700">
          {prefs.preferred_return_rate != null ? `${prefs.preferred_return_rate}%` : t('notSpecified')}
        </span>
      </Row>
      <Row label={t('prefHoldPeriod')}>
        <span className="text-sm text-rp-gray-700">{prefs.hold_period_years || t('notSpecified')}</span>
      </Row>
      <Row label={t('prefStructure')}>
        <Chips items={prefs.structure_preferences} labelMap={STRUCTURE_LABEL} />
      </Row>
    </div>
  );
}
