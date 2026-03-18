'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

interface InvestorRow {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  created_at: string;
  last_active_at: string | null;
  deals_viewed: number;
}

interface InvestorListClientProps {
  investors: InvestorRow[];
  locale: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';

  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;
  return formatDate(dateStr);
}

export default function InvestorListClient({ investors, locale }: InvestorListClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (investors.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[24px] font-bold text-rp-navy">Investors</h1>
          <Link href={`/${locale}/admin/investors/invite`}>
            <Button variant="gold">Invite New Investor</Button>
          </Link>
        </div>
        <div className="bg-white rounded-2xl border border-rp-gray-200 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rp-gray-100 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="7" r="3.5" stroke="#94A3B8" strokeWidth="1.5" />
              <path d="M2 19c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M19 8v6M22 11h-6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-rp-gray-500 text-sm mb-1">No investors yet</p>
          <p className="text-rp-gray-400 text-xs">Invite your first investor to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-bold text-rp-navy">Investors</h1>
        <Link href={`/${locale}/admin/investors/invite`}>
          <Button variant="gold">Invite New Investor</Button>
        </Link>
      </div>
      <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-rp-gray-200">
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                Name
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                Email
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                Company
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                Joined
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                Last Active
              </th>
              <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">
                Deals Viewed
              </th>
            </tr>
          </thead>
          <tbody>
            {investors.map((investor) => (
              <tr
                key={investor.id}
                onClick={() => setSelectedId(investor.id === selectedId ? null : investor.id)}
                className={`border-b border-rp-gray-100 last:border-b-0 cursor-pointer transition-colors ${
                  investor.id === selectedId
                    ? 'bg-rp-gold/5'
                    : 'hover:bg-rp-gray-100'
                }`}
              >
                <td className="px-5 py-3.5 text-sm font-medium text-rp-navy">
                  {investor.full_name}
                </td>
                <td className="px-5 py-3.5 text-sm text-rp-gray-600">
                  {investor.email}
                </td>
                <td className="px-5 py-3.5 text-sm text-rp-gray-600">
                  {investor.company_name ?? '\u2014'}
                </td>
                <td className="px-5 py-3.5 text-sm text-rp-gray-600">
                  {formatDate(investor.created_at)}
                </td>
                <td className="px-5 py-3.5 text-sm text-rp-gray-600">
                  {formatRelativeTime(investor.last_active_at)}
                </td>
                <td className="px-5 py-3.5 text-sm text-rp-gray-600">
                  {investor.deals_viewed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
