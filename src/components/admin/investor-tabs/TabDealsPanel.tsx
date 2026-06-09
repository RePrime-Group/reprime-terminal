'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { AssignedDealRow, PickableDeal } from './types';
import MultiSelectDropdown from './MultiSelectDropdown';
import {
  addDealsToTab,
  removeDealFromTab,
  reorderTabDeals,
} from '@/app/[locale]/(admin)/admin/investor-tabs/actions';

export default function TabDealsPanel({
  tabId,
  assignedDeals,
  allDeals,
}: {
  tabId: string;
  assignedDeals: AssignedDealRow[];
  allDeals: PickableDeal[];
}) {
  const t = useTranslations('admin.investorTabs');
  const router = useRouter();

  // Local copy kept in sync with server data; also drives instant feedback for
  // add / remove / reorder before router.refresh reconciles.
  const [order, setOrder] = useState<AssignedDealRow[]>(assignedDeals);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrder(assignedDeals);
  }, [assignedDeals]);

  const assignedIds = useMemo(() => new Set(order.map((d) => d.deal_id)), [order]);
  const candidates = useMemo(
    () => allDeals.filter((d) => !assignedIds.has(d.id)),
    [allDeals, assignedIds],
  );

  async function handleAdd(dealIds: string[]): Promise<boolean> {
    setError(null);
    const res = await addDealsToTab(tabId, dealIds);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    // Optimistic: append the newly assigned deals to the bottom of the list.
    const added: AssignedDealRow[] = allDeals
      .filter((d) => dealIds.includes(d.id))
      .map((d, i) => ({
        deal_id: d.id,
        name: d.name,
        status: d.status,
        city: d.city,
        state: d.state,
        match_reason: null,
        internal_note: null,
        display_order: order.length + i,
      }));
    setOrder((prev) => [...prev, ...added]);
    router.refresh();
    return true;
  }

  async function handleRemove(dealId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await removeDealFromTab(tabId, dealId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOrder((prev) => prev.filter((d) => d.deal_id !== dealId));
    router.refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= order.length || busy) return;
    const prevOrder = order;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setBusy(true);
    setError(null);
    const res = await reorderTabDeals(tabId, next.map((d) => d.deal_id));
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setOrder(prevOrder); // revert on failure
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-rp-navy">{t('dealsTitle')}</h2>
          <p className="text-[12px] text-rp-gray-500 mt-0.5">{t('dealsSubtitle')}</p>
        </div>
        <MultiSelectDropdown
          triggerLabel={`+ ${t('addDeals')}`}
          searchPlaceholder={t('searchDeals')}
          emptyText={t('noDealsToAdd')}
          options={candidates.map((d) => ({
            id: d.id,
            primary: d.name,
            secondary: `${[d.city, d.state].filter(Boolean).join(', ')} · ${d.status}`,
          }))}
          confirmLabel={(count) => t('addSelected', { count })}
          onConfirm={handleAdd}
        />
      </div>

      {error && <p className="text-xs text-rp-red mb-3">{error}</p>}

      {order.length === 0 ? (
        <p className="text-sm text-rp-gray-400 py-4 text-center">{t('noDeals')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rp-gray-100">
          {order.map((d, i) => (
            <li key={d.deal_id} className="flex items-center gap-3 py-2.5">
              {/* Reorder controls */}
              <div className="flex flex-col text-[11px] leading-none">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || busy}
                  aria-label={t('moveUp')}
                  className="text-rp-gray-400 hover:text-rp-navy disabled:opacity-30 py-0.5"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1 || busy}
                  aria-label={t('moveDown')}
                  className="text-rp-gray-400 hover:text-rp-navy disabled:opacity-30 py-0.5"
                >
                  ▼
                </button>
              </div>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-rp-gray-700 truncate">{d.name}</span>
                <span className="block text-[11px] text-rp-gray-400 truncate">
                  {[d.city, d.state].filter(Boolean).join(', ')} · {d.status}
                </span>
                {d.match_reason && (
                  <span className="block text-[11px] text-rp-gold mt-0.5 truncate">{d.match_reason}</span>
                )}
              </span>
              <button
                onClick={() => handleRemove(d.deal_id)}
                disabled={busy}
                className="flex-shrink-0 text-[12px] font-semibold text-rp-red/70 hover:text-rp-red transition-colors disabled:opacity-50"
              >
                {t('remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
