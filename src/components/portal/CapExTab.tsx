'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  sortCapExForDisplay,
  groupByPriority,
  computeAnnualizedReserve,
  computeTotalDuringHold,
  conditionColor,
  formatMoney,
} from '@/lib/utils/capex';
import type { CapExItem } from '@/lib/types/database';

interface BuildingOption {
  id: string;
  label: string;
}

interface CapExTabProps {
  items: CapExItem[];
  holdPeriodYears: number;
  isPortfolio?: boolean;
  buildings?: BuildingOption[];
}

const ALL_BUILDINGS = '__all__';

export default function CapExTab({
  items,
  holdPeriodYears,
  isPortfolio = false,
  buildings = [],
}: CapExTabProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(ALL_BUILDINGS);
  const t = useTranslations('portal.capex');

  const filtered = isPortfolio && selectedBuildingId !== ALL_BUILDINGS
    ? items.filter((i) => i.address_id === selectedBuildingId)
    : items;

  const sorted = sortCapExForDisplay(filtered);
  const totals = groupByPriority(filtered);
  const totalDuringHold = computeTotalDuringHold(filtered);
  const annualized = computeAnnualizedReserve(filtered, holdPeriodYears);

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-10 text-center">
        <p className="text-[14px] text-rp-gray-500">
          {t('emptyState')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isPortfolio && buildings.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-rp-gray-200 p-4">
          <label className="text-[12px] font-medium text-rp-gray-600">
            {t('viewingConditionFor')}
          </label>
          <select
            value={selectedBuildingId}
            onChange={(e) => setSelectedBuildingId(e.target.value)}
            className="px-3.5 py-2 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
          >
            <option value={ALL_BUILDINGS}>{t('allBuildings')}</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id} dir="auto">{b.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Condition table */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-rp-gray-200">
          <h2 className="text-[16px] font-semibold text-rp-navy font-[family-name:var(--font-playfair)]">
            {t('propertyCondition')}
          </h2>
          <p className="text-[12px] text-rp-gray-500 mt-1">
            {t('informationalOnly')}
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="py-10 text-center text-rp-gray-400 text-[13px]">
            {t('noItems')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-rp-gray-500 border-b border-rp-gray-200 bg-rp-gray-50/50">
                  <th className="py-3 px-6">{t('colComponent')}</th>
                  <th className="py-3 px-3">{t('colCondition')}</th>
                  <th className="py-3 px-3">{t('colLastReplaced')}</th>
                  <th className="py-3 px-3">{t('colLifeRemaining')}</th>
                  <th className="py-3 px-3 text-right">{t('colReplacementCost')}</th>
                  <th className="py-3 px-3">{t('colPriority')}</th>
                  <th className="py-3 px-6 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const cc = conditionColor(item.current_condition);
                  const isExpanded = expandedIds.has(item.id);
                  const hasNotes = !!(item.notes && item.notes.trim());
                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`border-b border-rp-gray-100 ${hasNotes ? 'cursor-pointer hover:bg-rp-gray-50/50' : ''}`}
                        onClick={() => hasNotes && toggle(item.id)}
                      >
                        <td dir="auto" className="py-3 px-6 font-medium text-rp-navy">{item.component_name}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cc.bg} ${cc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`} />
                            {t.has(`conditions.${String(item.current_condition).replace(/[^A-Za-z0-9]/g, '')}`)
                              ? t(`conditions.${String(item.current_condition).replace(/[^A-Za-z0-9]/g, '')}`)
                              : item.current_condition}
                          </span>
                        </td>
                        <td dir="auto" className="py-3 px-3 text-rp-gray-600">{item.year_last_replaced ?? '—'}</td>
                        <td dir="auto" className="py-3 px-3 text-rp-gray-600">{item.useful_life_remaining ?? '—'}</td>
                        <td className="py-3 px-3 text-right tabular-nums">{formatMoney(item.estimated_replacement_cost)}</td>
                        <td className="py-3 px-3 text-rp-gray-600">
                          {t.has(`priorities.${String(item.priority).replace(/[^A-Za-z0-9]/g, '')}`)
                            ? t(`priorities.${String(item.priority).replace(/[^A-Za-z0-9]/g, '')}`)
                            : item.priority}
                        </td>
                        <td className="py-3 px-6 text-rp-gray-400 text-xs">
                          {hasNotes ? (isExpanded ? '▲' : '▼') : ''}
                        </td>
                      </tr>
                      {isExpanded && hasNotes && (
                        <tr className="bg-rp-gray-50/50">
                          <td colSpan={7} className="py-3 px-6">
                            <div className="text-[12px] text-rp-gray-600 whitespace-pre-wrap">
                              <span className="font-semibold text-rp-gray-700">{t('notes')} </span>
                              <bdi>{item.notes}</bdi>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Budget summary */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
        <h2 className="text-[16px] font-semibold text-rp-navy font-[family-name:var(--font-playfair)] mb-4">
          {t('budgetSummary')}
        </h2>
        <div className="space-y-2 text-[13px]">
          <BudgetRow label={t('priorities.Immediate')} value={formatMoney(totals['Immediate'], false)} />
          <BudgetRow label={t('nearTermYears')} value={formatMoney(totals['Near-Term'], false)} />
          <BudgetRow label={t('duringHoldYears')} value={formatMoney(totals['During Hold'], false)} />
          <BudgetRow label={t('priorities.PostHold')} value={formatMoney(totals['Post-Hold'], false)} />
          {totals['N/A'] > 0 && (
            <BudgetRow label={t('priorities.NA')} value={formatMoney(totals['N/A'], false)} />
          )}
        </div>
        <div className="border-t border-rp-gray-200 mt-4 pt-4 space-y-2 text-[13px]">
          <BudgetRow
            label={t('totalDuringHold')}
            value={formatMoney(totalDuringHold, false)}
            strong
          />
          <BudgetRow
            label={t('annualizedReserve', { years: holdPeriodYears })}
            value={t('perYear', { amount: formatMoney(annualized, false) })}
            strong
          />
        </div>
        <p className="mt-4 text-[11px] text-rp-gray-500 italic">
          {t('footnote')}
        </p>
      </div>
    </div>
  );
}

function BudgetRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? 'font-semibold text-rp-navy' : 'text-rp-gray-600'}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold text-rp-navy' : 'text-rp-gray-700'}`}>{value}</span>
    </div>
  );
}
