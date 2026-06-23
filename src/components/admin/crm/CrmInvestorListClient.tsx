'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { CrmInvestorStatus, TerminalCrmInvestorSummary } from '@/lib/types/database';
import { formatPrice } from '@/lib/utils/format';
import { STATUS_OPTIONS } from './CrmConstants';
import CrmInvestorCard from './CrmInvestorCard';

type StatusFilter = 'all' | CrmInvestorStatus;

function num(value: string | null): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

export default function CrmInvestorListClient({
  investors,
  locale,
}: {
  investors: TerminalCrmInvestorSummary[];
  locale: string;
}) {
  const t = useTranslations('admin.crm');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const stats = useMemo(() => {
    return {
      total: investors.length,
      equityReady: investors.reduce((s, i) => s + num(i.equity_ready), 0),
      equityCommitted: investors.reduce((s, i) => s + num(i.equity_committed), 0),
      deployed: investors.reduce((s, i) => s + num(i.total_deployed_with_reprime), 0),
      pendingFollowUps: investors.reduce((s, i) => s + (i.pending_follow_up_count ?? 0), 0),
    };
  }, [investors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return investors.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [i.full_name, i.company_name, i.email].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [investors, search, statusFilter]);

  const statCards = [
    { label: t('statTotalInvestors'), value: String(stats.total) },
    { label: t('statEquityReady'), value: formatPrice(stats.equityReady) },
    { label: t('statEquityCommitted'), value: formatPrice(stats.equityCommitted) },
    { label: t('statTotalDeployed'), value: formatPrice(stats.deployed) },
    {
      label: t('statPendingFollowUps'),
      value: String(stats.pendingFollowUps),
      alert: stats.pendingFollowUps > 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-rp-navy">{t('title')}</h1>
          <p className="text-sm text-rp-gray-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <Link
            href={`/${locale}/admin/crm/import`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-rp-gray-300 text-rp-navy text-sm font-semibold hover:border-rp-gold/40 transition-colors"
          >
            ↑ {t('importXlsx')}
          </Link>
          <Link
            href={`/${locale}/admin/crm/new`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            + {t('addInvestor')}
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-4">
            <div className="text-[10px] uppercase tracking-wide text-rp-gray-400">{s.label}</div>
            <div
              className={`text-xl font-bold tabular-nums mt-1 ${s.alert ? 'text-rp-red' : 'text-rp-navy'}`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="flex-1 px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            {t('filterAll')}
          </FilterPill>
          {STATUS_OPTIONS.map((o) => (
            <FilterPill
              key={o.value}
              active={statusFilter === o.value}
              onClick={() => setStatusFilter(o.value)}
            >
              {o.label}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-rp-gray-200">
          {investors.length === 0 ? (
            <>
              <p className="text-rp-navy font-semibold">{t('emptyTitle')}</p>
              <p className="text-sm text-rp-gray-500 mt-1">{t('emptyBody')}</p>
            </>
          ) : (
            <p className="text-sm text-rp-gray-500">{t('noInvestors')}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((i) => (
            <CrmInvestorCard key={i.id} investor={i} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-rp-navy text-white border-rp-navy'
          : 'bg-white text-rp-gray-600 border-rp-gray-200 hover:border-rp-gold/40'
      }`}
    >
      {children}
    </button>
  );
}
