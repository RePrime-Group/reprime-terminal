'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { formatPrice } from '@/lib/utils/format';

interface InterestRow {
  id: string;
  deal_id: string;
  deal_name: string;
  deal_location: string;
  deal_status: string | null;
  asking_price: string | null;
  investor_name: string;
  investor_email: string;
  investor_company: string | null;
  interest_type: 'at_asking' | 'custom_price';
  target_price: number | null;
  notes: string | null;
  created_at: string;
}

type InterestFilter = 'all' | 'at_asking' | 'custom_price';

interface MarketplaceInterestListClientProps {
  rows: InterestRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<InterestFilter, number>;
  interestFilter: InterestFilter;
  dealOptions: { id: string; label: string }[];
  dealFilter: string | null;
  locale: string;
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function num(s: string | null): number {
  if (!s) return 0;
  return parseFloat(String(s).replace(/[$,\s]/g, '')) || 0;
}

export default function MarketplaceInterestListClient({
  rows,
  total,
  page,
  pageSize,
  counts,
  interestFilter,
  dealOptions,
  dealFilter,
  locale,
}: MarketplaceInterestListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleFilter = (f: InterestFilter) => {
    updateParams({ type: f === 'all' ? null : f, p: '1' });
  };

  const handleDealFilter = (dealId: string) => {
    updateParams({ deal: dealId === 'all' ? null : dealId, p: '1' });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterTabs: { key: InterestFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'at_asking', label: 'At asking' },
    { key: 'custom_price', label: 'Custom price' },
  ];

  return (
    <div className="font-[family-name:var(--font-poppins)]">
      <header className="mb-6">
        <h1 className="text-[24px] font-bold text-rp-navy">Marketplace Interest</h1>
        <p className="text-[13px] text-rp-gray-500 mt-1">
          Every expression of interest across all marketplace deals — pricing guidance for the team.
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1 bg-white rounded-lg border border-rp-gray-200 p-1">
          {filterTabs.map((tab) => {
            const active = tab.key === interestFilter;
            return (
              <button
                key={tab.key}
                onClick={() => handleFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                  active ? 'bg-rp-navy text-white' : 'text-rp-gray-500 hover:text-rp-navy'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-[10px] ${active ? 'text-white/70' : 'text-rp-gray-400'}`}>
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] font-semibold text-rp-gray-500 uppercase tracking-wider">Deal</span>
          <select
            value={dealFilter ?? 'all'}
            onChange={(e) => handleDealFilter(e.target.value)}
            className="text-[12px] font-medium border border-rp-gray-200 rounded-md px-2 py-1.5 text-rp-navy bg-white max-w-[280px]"
          >
            <option value="all">All deals</option>
            {dealOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-rp-gray-200 px-6 py-12 text-center">
          <p className="text-[13px] text-rp-gray-400">No marketplace interest matches these filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rp-gray-200">
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Investor</th>
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Deal</th>
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Interest</th>
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Target Price</th>
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Notes</th>
                <th className="text-right text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const askingNum = num(row.asking_price);
                const target = row.target_price != null ? Number(row.target_price) : null;
                const delta = target != null && askingNum > 0
                  ? ((target - askingNum) / askingNum) * 100
                  : null;
                const isCustom = row.interest_type === 'custom_price';
                return (
                  <tr key={row.id} className="border-b border-rp-gray-100 last:border-b-0 hover:bg-rp-gray-50">
                    <td className="px-5 py-3.5 text-sm align-top">
                      <div className="font-medium text-rp-navy">{row.investor_name}</div>
                      <div className="text-[11px] text-rp-gray-500">
                        {row.investor_email}
                        {row.investor_company ? ` · ${row.investor_company}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm align-top">
                      <Link
                        href={`/${locale}/admin/deals/${row.deal_id}`}
                        className="font-medium text-rp-navy hover:underline"
                      >
                        {row.deal_name}
                      </Link>
                      <div className="text-[11px] text-rp-gray-500">
                        {row.deal_location}
                        {row.deal_status && row.deal_status !== 'marketplace' ? (
                          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9F580B] bg-[#FFF7ED] border border-[#FED7AA] rounded px-1 py-0.5">
                            {row.deal_status}
                          </span>
                        ) : null}
                      </div>
                      {row.asking_price && (
                        <div className="text-[11px] text-rp-gray-400 mt-0.5">
                          Asking: {formatPrice(askingNum)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm align-top">
                      {isCustom ? (
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9F580B] bg-[#FFF7ED] border border-[#FED7AA] rounded px-1.5 py-0.5">
                          Custom price
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#166534] bg-[#DCFCE7] border border-[#BBF7D0] rounded px-1.5 py-0.5">
                          At asking
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-rp-navy align-top">
                      {target != null ? (
                        <div>
                          <div className="font-medium">{formatPrice(target)}</div>
                          {delta != null && (
                            <div className={`text-[11px] ${delta < 0 ? 'text-[#991B1B]' : 'text-[#166534]'}`}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs asking
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-rp-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600 align-top max-w-xs">
                      {row.notes ? <span className="line-clamp-2">{row.notes}</span> : <span className="text-rp-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-500 text-right whitespace-nowrap align-top">
                      {fmtDate(row.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-rp-gray-200">
              <p className="text-xs text-rp-gray-400">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => updateParams({ p: String(page - 1) })}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-rp-gray-200 text-rp-gray-600 hover:bg-rp-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => updateParams({ p: String(page + 1) })}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-rp-gray-200 text-rp-gray-600 hover:bg-rp-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
