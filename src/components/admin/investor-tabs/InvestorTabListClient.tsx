'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import type { GroupSummary } from './types';
import CreateTabModal from './CreateTabModal';

export default function InvestorTabListClient({
  groups,
  locale,
}: {
  groups: GroupSummary[];
  locale: string;
}) {
  const t = useTranslations('admin.investorTabs');
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-rp-navy">{t('title')}</h1>
          <p className="text-sm text-rp-gray-500 mt-1">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          + {t('createGroup')}
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchGroups')}
        className="w-full sm:max-w-sm px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold outline-none"
      />

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-rp-gray-200 text-sm text-rp-gray-500">
          {groups.length === 0 ? t('emptyNoGroups') : t('emptyNoMatch')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <Link
              key={g.id}
              href={`/admin/investor-tabs/${g.id}`}
              locale={locale}
              className="block bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-5 hover:border-rp-gold/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold text-rp-navy truncate">{g.name}</h2>
                <span
                  className={`flex-shrink-0 inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    g.is_enabled
                      ? 'bg-rp-green-light text-rp-green'
                      : 'bg-rp-gray-200 text-rp-gray-600'
                  }`}
                >
                  {g.is_enabled ? t('statusEnabled') : t('statusDisabled')}
                </span>
              </div>
              {g.hero_note && (
                <p className="text-xs text-rp-gray-500 mt-2 line-clamp-2">{g.hero_note}</p>
              )}
              <div className="flex items-center gap-4 mt-4 text-xs text-rp-gray-500">
                <span>
                  <span className="font-semibold text-rp-navy tabular-nums">{g.member_count}</span>{' '}
                  {t('membersLabel')}
                </span>
                <span>
                  <span className="font-semibold text-rp-navy tabular-nums">{g.deal_count}</span>{' '}
                  {t('dealsLabel')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateTabModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          router.push(`/${locale}/admin/investor-tabs/${id}`);
        }}
      />
    </div>
  );
}
