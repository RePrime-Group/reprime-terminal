'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { DEAL_STATUS_LABELS } from '@/lib/constants';
import { formatPrice } from '@/lib/utils/format';
import type { TerminalDeal, DealStatus } from '@/lib/types/database';

interface DealListClientProps {
  deals: TerminalDeal[];
  locale: string;
}

const STATUS_OPTIONS: { value: DealStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_PILL_STYLES: Record<DealStatus, string> = {
  draft: 'bg-[#EEF0F4] text-[#4B5563]',
  published: 'bg-[#ECFDF5] text-[#0B8A4D]',
  under_review: 'bg-[#FFFBEB] text-[#D97706]',
  assigned: 'bg-[#FDF8ED] text-[#BC9C45]',
  closed: 'bg-[#0E3470]/10 text-[#0E3470]',
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
  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
        <h1 className="text-[24px] font-bold text-rp-navy">Deals</h1>
        <Link href={`/${locale}/admin/deals/new`}>
          <Button variant="gold">New Deal</Button>
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
          placeholder="Search deals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
      </div>

      {/* Table */}
      {filteredDeals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-rp-gray-200 p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rp-gray-100 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-rp-gray-400"
            >
              {/* Building icon */}
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M9 22V12h6v10" />
              <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
            </svg>
          </div>
          <h3 className="text-[16px] font-semibold text-rp-gray-700 mb-1">
            No deals yet
          </h3>
          <p className="text-sm text-rp-gray-400 mb-4">
            Create your first deal to get started.
          </p>
          <Link href={`/${locale}/admin/deals/new`}>
            <Button variant="gold" size="sm">
              New Deal
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F8FA]">
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-rp-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-rp-gray-500 uppercase tracking-wider">
                  City / State
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-rp-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-rp-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-rp-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-rp-gray-500 uppercase tracking-wider">
                  DD Deadline
                </th>
                <th className="text-left px-6 py-3.5 text-xs font-semibold text-rp-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rp-gray-200">
              {filteredDeals.map((deal) => (
                <tr
                  key={deal.id}
                  className="hover:bg-[#F7F8FA] cursor-pointer transition-colors duration-150"
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
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL_STYLES[deal.status] ?? 'bg-[#EEF0F4] text-[#4B5563]'}`}
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
                    <Link
                      href={`/${locale}/admin/deals/${deal.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
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
