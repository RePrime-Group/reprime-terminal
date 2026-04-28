'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { ActivityAction, UserRole } from '@/lib/types/database';

interface ActivityRow {
  id: string;
  created_at: string;
  action: ActivityAction;
  metadata: Record<string, unknown>;
  user_name: string | null;
  user_role: UserRole | null;
  deal_name: string | null;
}

interface FilterOptions {
  users: { id: string; name: string; role: UserRole }[];
  deals: { id: string; name: string }[];
}

interface ActivityLogClientProps {
  activities: ActivityRow[];
  filterOptions: FilterOptions;
}

const ALL_ACTIONS: ActivityAction[] = [
  'deal_viewed',
  'document_downloaded',
  'dataroom_viewed',
  'structure_viewed',
  'irr_calculator_used',
  'meeting_requested',
  'page_time',
  'expressed_interest',
  'commitment_withdrawn',
  'om_downloaded',
  'portal_viewed',
  'deal_created',
  'deal_published',
  'deal_updated',
  'deal_document_uploaded',
];

const ALL_ROLES: UserRole[] = ['owner', 'employee', 'investor'];

const PAGE_SIZE = 50;

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDetails(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return '—';
  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  owner: 'bg-rp-gold/10 text-rp-gold border-rp-gold/30',
  employee: 'bg-rp-navy/10 text-rp-navy border-rp-navy/20',
  investor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function generateCSV(
  rows: ActivityRow[],
  csvHeader: string,
  actionLabels: Record<ActivityAction, string>,
  roleLabels: Record<UserRole, string>,
): string {
  const header = csvHeader + '\n';
  const body = rows
    .map((r) => {
      const ts = new Date(r.created_at).toISOString();
      const name = (r.user_name ?? '').replace(/"/g, '""');
      const role = r.user_role ? roleLabels[r.user_role] : '';
      const deal = (r.deal_name ?? '').replace(/"/g, '""');
      const action = actionLabels[r.action];
      const details = formatDetails(r.metadata).replace(/"/g, '""');
      return `"${ts}","${name}","${role}","${deal}","${action}","${details}"`;
    })
    .join('\n');
  return header + body;
}

export default function ActivityLogClient({ activities, filterOptions }: ActivityLogClientProps) {
  const t = useTranslations('admin.activity');

  const ACTION_LABELS: Record<ActivityAction, string> = {
    deal_viewed: t('viewedDeal'),
    document_downloaded: t('downloadedDocument'),
    dataroom_viewed: t('viewedDataRoom'),
    structure_viewed: t('viewedStructure'),
    irr_calculator_used: t('usedIrrCalc'),
    meeting_requested: t('requestedMeeting'),
    page_time: t('timeOnPage'),
    expressed_interest: t('expressedInterest'),
    commitment_withdrawn: t('withdrewCommitment'),
    om_downloaded: t('downloadedOm'),
    portal_viewed: t('viewedPortal'),
    deal_created: t('dealCreated'),
    deal_published: t('dealPublished'),
    deal_updated: t('dealUpdated'),
    deal_document_uploaded: t('dealDocumentUploaded'),
  };

  const ROLE_LABELS: Record<UserRole, string> = {
    owner: t('roleOwner'),
    employee: t('roleEmployee'),
    investor: t('roleInvestor'),
  };

  const [userFilter, setUserFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [dealFilter, setDealFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visibleUserOptions = useMemo(() => {
    return roleFilter
      ? filterOptions.users.filter((u) => u.role === roleFilter)
      : filterOptions.users;
  }, [filterOptions.users, roleFilter]);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (userFilter && a.user_name !== userFilter) return false;
      if (roleFilter && a.user_role !== roleFilter) return false;
      if (dealFilter && a.deal_name !== dealFilter) return false;
      if (actionFilter && a.action !== actionFilter) return false;
      if (startDate) {
        const start = new Date(startDate);
        if (new Date(a.created_at) < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(a.created_at) > end) return false;
      }
      return true;
    });
  }, [activities, userFilter, roleFilter, dealFilter, actionFilter, startDate, endDate]);

  const visibleRows = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(filtered, t('csvHeader'), ACTION_LABELS, ROLE_LABELS);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filtered, t, ACTION_LABELS, ROLE_LABELS]);

  const selectClass =
    'px-3 py-2 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-bold text-rp-navy">{t('title')}</h1>
        <Button variant="secondary" onClick={handleExportCSV} size="sm">
          {t('exportCsv')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-[12px] font-medium text-rp-gray-500 mb-1">{t('role')}</label>
          <select
            value={roleFilter}
            onChange={(e) => {
              const next = e.target.value as UserRole | '';
              setRoleFilter(next);
              setUserFilter('');
              setVisibleCount(PAGE_SIZE);
            }}
            className={selectClass}
          >
            <option value="">{t('allRoles')}</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-rp-gray-500 mb-1">{t('user')}</label>
          <select
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className={selectClass}
          >
            <option value="">{t('allUsers')}</option>
            {visibleUserOptions.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-rp-gray-500 mb-1">{t('deal')}</label>
          <select
            value={dealFilter}
            onChange={(e) => { setDealFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className={selectClass}
          >
            <option value="">{t('allDeals')}</option>
            {filterOptions.deals.map((deal) => (
              <option key={deal.id} value={deal.name}>
                {deal.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-rp-gray-500 mb-1">{t('action')}</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className={selectClass}
          >
            <option value="">{t('allActions')}</option>
            {ALL_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Input
            label={t('startDate')}
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setVisibleCount(PAGE_SIZE); }}
          />
        </div>

        <div>
          <Input
            label={t('endDate')}
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setVisibleCount(PAGE_SIZE); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rp-gray-200">
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                {t('timestamp')}
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                {t('user')}
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                {t('role')}
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                {t('deal')}
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                {t('action')}
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                {t('details')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-rp-gray-400">
                  {t('noActivity')}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-rp-gray-100 last:border-b-0 hover:bg-rp-gray-100 transition-colors"
                >
                  <td className="px-5 py-3 text-sm text-rp-gray-600 whitespace-nowrap">
                    {formatTimestamp(row.created_at)}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-rp-navy">
                    {row.user_name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {row.user_role ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${ROLE_BADGE_CLASS[row.user_role]}`}
                      >
                        {ROLE_LABELS[row.user_role]}
                      </span>
                    ) : (
                      <span className="text-rp-gray-400">{'—'}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-rp-gray-600">
                    {row.deal_name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-rp-gray-600">
                    {ACTION_LABELS[row.action]}
                  </td>
                  <td className="px-5 py-3 text-sm text-rp-gray-500 max-w-xs truncate">
                    {formatDetails(row.metadata)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Load More */}
        {hasMore && (
          <div className="px-5 py-4 border-t border-rp-gray-200 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              {t('loadMore', { count: filtered.length - visibleCount })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
