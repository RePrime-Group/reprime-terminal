'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { ActivityAction } from '@/lib/types/database';

interface ActivityRow {
  id: string;
  created_at: string;
  action: ActivityAction;
  metadata: Record<string, unknown>;
  investor_name: string | null;
  deal_name: string | null;
}

interface FilterOptions {
  investors: { id: string; name: string }[];
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
  'om_downloaded',
  'portal_viewed',
];

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
  if (entries.length === 0) return '\u2014';
  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}

function generateCSV(rows: ActivityRow[], csvHeader: string, actionLabels: Record<ActivityAction, string>): string {
  const header = csvHeader + '\n';
  const body = rows
    .map((r) => {
      const ts = new Date(r.created_at).toISOString();
      const investor = (r.investor_name ?? '').replace(/"/g, '""');
      const deal = (r.deal_name ?? '').replace(/"/g, '""');
      const action = actionLabels[r.action];
      const details = formatDetails(r.metadata).replace(/"/g, '""');
      return `"${ts}","${investor}","${deal}","${action}","${details}"`;
    })
    .join('\n');
  return header + body;
}

export default function ActivityLogClient({ activities, filterOptions }: ActivityLogClientProps) {
  const t = useTranslations('admin.activity');
  const tc = useTranslations('common');

  const ACTION_LABELS: Record<ActivityAction, string> = {
    deal_viewed: t('viewedDeal'),
    document_downloaded: t('downloadedDocument'),
    dataroom_viewed: t('viewedDataRoom'),
    structure_viewed: t('viewedStructure'),
    irr_calculator_used: t('usedIrrCalc'),
    meeting_requested: t('requestedMeeting'),
    page_time: t('timeOnPage'),
    expressed_interest: t('expressedInterest'),
    om_downloaded: t('downloadedOm'),
    portal_viewed: t('viewedPortal'),
  };

  const [investorFilter, setInvestorFilter] = useState('');
  const [dealFilter, setDealFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (investorFilter && a.investor_name !== investorFilter) return false;
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
  }, [activities, investorFilter, dealFilter, actionFilter, startDate, endDate]);

  const visibleRows = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(filtered, t('csvHeader'), ACTION_LABELS);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filtered, t, ACTION_LABELS]);

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
          <label className="block text-[12px] font-medium text-rp-gray-500 mb-1">{t('investor')}</label>
          <select
            value={investorFilter}
            onChange={(e) => { setInvestorFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className={selectClass}
          >
            <option value="">{t('allInvestors')}</option>
            {filterOptions.investors.map((inv) => (
              <option key={inv.id} value={inv.name}>
                {inv.name}
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
                {t('investor')}
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
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-rp-gray-400">
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
                    {row.investor_name ?? '\u2014'}
                  </td>
                  <td className="px-5 py-3 text-sm text-rp-gray-600">
                    {row.deal_name ?? '\u2014'}
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
