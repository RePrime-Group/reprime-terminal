'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { MemberRow, PickableInvestor } from './types';
import MultiSelectDropdown from './MultiSelectDropdown';
import { addTabMembers, removeTabMember } from '@/app/[locale]/(admin)/admin/investor-tabs/actions';

export default function TabMembersPanel({
  tabId,
  members,
  allInvestors,
}: {
  tabId: string;
  members: MemberRow[];
  allInvestors: PickableInvestor[];
}) {
  const t = useTranslations('admin.investorTabs');
  const router = useRouter();

  // Local copy kept in sync with the server data, updated optimistically so
  // added/removed members show immediately (router.refresh reconciles after).
  const [rows, setRows] = useState<MemberRow[]>(members);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(members);
  }, [members]);

  const memberIds = useMemo(() => new Set(rows.map((m) => m.user_id)), [rows]);
  const candidates = useMemo(
    () => allInvestors.filter((inv) => !memberIds.has(inv.id)),
    [allInvestors, memberIds],
  );

  async function handleAdd(userIds: string[]): Promise<boolean> {
    setError(null);
    const res = await addTabMembers(tabId, userIds);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    // Optimistic: show the newly added investors right away.
    const added = allInvestors
      .filter((inv) => userIds.includes(inv.id))
      .map((inv) => ({ user_id: inv.id, full_name: inv.full_name, email: inv.email }));
    setRows((prev) => [...prev, ...added]);
    router.refresh();
    return true;
  }

  async function handleRemove(userId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await removeTabMember(tabId, userId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRows((prev) => prev.filter((m) => m.user_id !== userId));
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-rp-navy">{t('membersTitle')}</h2>
          <p className="text-[12px] text-rp-gray-500 mt-0.5">{t('membersSubtitle')}</p>
        </div>
        <MultiSelectDropdown
          triggerLabel={`+ ${t('addMembers')}`}
          searchPlaceholder={t('searchInvestors')}
          emptyText={t('noInvestorsToAdd')}
          options={candidates.map((inv) => ({
            id: inv.id,
            primary: inv.full_name || t('unnamedInvestor'),
            secondary: inv.email ?? undefined,
          }))}
          confirmLabel={(count) => t('addSelected', { count })}
          onConfirm={handleAdd}
        />
      </div>

      {error && <p className="text-xs text-rp-red mb-3">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-rp-gray-400 py-4 text-center">{t('noMembers')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rp-gray-100">
          {rows.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-rp-gray-700 truncate">
                  {m.full_name || t('unnamedInvestor')}
                </span>
                {m.email && (
                  <span className="block text-[11px] text-rp-gray-400 truncate">{m.email}</span>
                )}
              </span>
              <button
                onClick={() => handleRemove(m.user_id)}
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
