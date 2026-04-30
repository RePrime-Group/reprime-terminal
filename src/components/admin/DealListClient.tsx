'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Input from '@/components/ui/Input';
import { DEAL_STATUS_LABELS } from '@/lib/constants';
import { formatPrice } from '@/lib/utils/format';
import type { TerminalDeal, DealStatus } from '@/lib/types/database';

interface DealListClientProps {
  deals: TerminalDeal[];
  locale: string;
}

const STATUS_PILL_STYLES: Record<DealStatus, string> = {
  draft: 'bg-[#F7F8FA] text-[#4B5563] border border-[#EEF0F4]',
  coming_soon: 'bg-[#0E3470]/[0.06] text-[#0E3470] border border-[#0E3470]/[0.12]',
  marketplace: 'bg-[#ECFDFD] text-[#0E7490] border border-[#0E7490]/20',
  loi_signed: 'bg-[#BC9C45]/10 text-[#BC9C45] border border-[#BC9C45]/20',
  published: 'bg-[#ECFDF5] text-[#0B8A4D] border border-[#A7F3D0]',
  under_review: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]',
  assigned: 'bg-[#FDF8ED] text-[#BC9C45] border border-[#ECD9A0]',
  closed: 'bg-[#0E3470] text-white',
  cancelled: 'bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isDeadlinePast(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function DealListClient({ deals, locale }: DealListClientProps) {
  const t = useTranslations('admin.dealList');
  const tc = useTranslations('common');
  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const STATUS_OPTIONS: { value: DealStatus | 'all'; label: string }[] = [
    { value: 'all', label: t('allStatuses') },
    { value: 'draft', label: t('statusDraft') },
    { value: 'coming_soon', label: t('statusComingSoon') },
    { value: 'loi_signed', label: t('statusLoiSigned') },
    { value: 'published', label: t('statusPublished') },
    { value: 'under_review', label: t('statusUnderReview') },
    { value: 'assigned', label: t('statusAssigned') },
    { value: 'closed', label: t('statusClosed') },
    { value: 'cancelled', label: t('statusCancelled') },
  ];

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (statusFilter !== 'all' && deal.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const searchable = `${deal.name} ${deal.city} ${deal.state} ${deal.property_type}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [deals, statusFilter, searchQuery]);

  return (
    <div className="font-[family-name:var(--font-poppins)]">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-bold text-rp-navy">{t('title')}</h1>
        <Link href={`/${locale}/admin/deals/new`}>
          <button className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-5 py-2.5 rounded-lg shadow-[0_2px_8px_rgba(188,156,69,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(188,156,69,0.25)] transition-all">
            {t('newDeal')}
          </button>
        </Link>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DealStatus | 'all')}
          className="px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Input
          placeholder={t('searchDeals')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
      </div>

      {/* Table */}
      {filteredDeals.length === 0 ? (
        <div className="bg-white rounded-2xl rp-card-shadow p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1A4A8A] flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              {/* Building icon */}
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M9 22V12h6v10" />
              <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
            </svg>
          </div>
          <h3 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-rp-navy mb-1">
            {t('noDealsYet')}
          </h3>
          <p className="text-sm text-rp-gray-400 mb-4">
            {t('createFirstDeal')}
          </p>
          <Link href={`/${locale}/admin/deals/new`}>
            <button className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-5 py-2.5 rounded-lg shadow-[0_2px_8px_rgba(188,156,69,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(188,156,69,0.25)] transition-all text-sm">
              {t('newDeal')}
            </button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl rp-card-shadow overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F8FA]">
                <th className="text-left px-6 py-3.5 text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
                  {t('name')}
                </th>
                <th className="text-left px-6 py-3.5 text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
                  {t('cityState')}
                </th>
                <th className="text-left px-6 py-3.5 text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
                  {t('type')}
                </th>
                <th className="text-left px-6 py-3.5 text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
                  {t('price')}
                </th>
                <th className="text-left px-6 py-3.5 text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
                  {t('status')}
                </th>
                <th className="text-left px-6 py-3.5 text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
                  {t('ddDeadline')}
                </th>
                <th className="text-left px-6 py-3.5 text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
                  {tc('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rp-gray-200">
              {filteredDeals.map((deal, index) => (
                <tr
                  key={deal.id}
                  className={`hover:bg-[#FAFBFC] cursor-pointer transition-colors duration-150 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-[#F7F8FA]'
                  }`}
                  onClick={() => {
                    window.location.href = `/${locale}/admin/deals/${deal.id}`;
                  }}
                >
                  <td className="px-6 py-4 text-sm font-medium text-rp-navy">
                    {deal.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-rp-gray-600">
                    {deal.city}, {deal.state}
                  </td>
                  <td className="px-6 py-4 text-sm text-rp-gray-600">
                    {deal.property_type}
                  </td>
                  <td className="px-6 py-4 text-sm text-rp-gray-700 font-medium">
                    {formatPrice(deal.purchase_price)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center ${STATUS_PILL_STYLES[deal.status] ?? 'bg-[#F7F8FA] text-[#4B5563] border border-[#EEF0F4]'}`}
                    >
                      {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 text-sm ${
                      isDeadlinePast(deal.dd_deadline)
                        ? 'text-red-600 font-semibold'
                        : 'text-rp-gray-600'
                    }`}
                  >
                    {formatDate(deal.dd_deadline)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/${locale}/admin/deals/${deal.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-rp-navy hover:text-rp-gold font-medium transition-colors"
                      >
                        {tc('edit')}
                      </Link>
                      <Link
                        href={`/${locale}/admin/deals/${deal.id}/pipeline`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-rp-gray-400 hover:text-rp-gold transition-colors"
                        title={t('pipeline')}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="5" cy="6" r="2" />
                          <circle cx="12" cy="6" r="2" />
                          <circle cx="19" cy="18" r="2" />
                          <path d="M5 8v2a4 4 0 004 4h2" />
                          <path d="M12 8v2a4 4 0 004 4h1" />
                          <line x1="7" y1="14" x2="17" y2="14" />
                        </svg>
                      </Link>
                      {['published', 'assigned', 'closed', 'cancelled'].includes(deal.status) && (
                        <a
                          href={`/${locale}/admin/deals/${deal.id}/preview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-rp-gray-400 hover:text-rp-gold transition-colors"
                          title={t('previewAsInvestor')}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
