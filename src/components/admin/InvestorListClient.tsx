'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';

interface InvestorRow {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  created_at: string;
  last_active_at: string | null;
  deals_viewed: number;
  is_active: boolean;
  parent_investor_id: string | null;
  parent_name: string | null;
  parent_inactive: boolean;
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

type Tab = 'investors' | 'invitations';
type InviteFilter = 'all' | 'pending' | 'accepted' | 'expired';

interface InvestorListClientProps {
  investors: InvestorRow[];
  investorTotal: number;
  investorPage: number;
  invitations: InvitationRow[];
  invitationTotal: number;
  invitationPage: number;
  inviteFilter: InviteFilter;
  inviteCounts: Record<InviteFilter, number>;
  locale: string;
  tab: Tab;
  pageSize: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(dateStr: string | null, t: (key: string, values?: Record<string, string | number>) => string): string {
  if (!dateStr) return t('never');

  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffMin < 1) return t('justNow');
  if (diffMin < 60) return diffMin === 1 ? t('minuteAgo', { count: diffMin }) : t('minutesAgo', { count: diffMin });
  if (diffHr < 24) return diffHr === 1 ? t('hourAgo', { count: diffHr }) : t('hoursAgo', { count: diffHr });
  if (diffDay < 7) return diffDay === 1 ? t('dayAgo', { count: diffDay }) : t('daysAgo', { count: diffDay });
  if (diffWeek < 4) return diffWeek === 1 ? t('weekAgo', { count: diffWeek }) : t('weeksAgo', { count: diffWeek });
  return formatDate(dateStr);
}

function getInviteStatus(inv: InvitationRow): 'accepted' | 'expired' | 'pending' {
  if (inv.accepted_at) return 'accepted';
  if (new Date(inv.expires_at) < new Date()) return 'expired';
  return 'pending';
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  accepted: 'bg-green-50 text-green-700 border border-green-200',
  expired: 'bg-red-50 text-red-500 border border-red-200',
};

function Pagination({ page, totalPages, onPageChange, labels }: { page: number; totalPages: number; onPageChange: (p: number) => void; labels: { page: string; of: string; previous: string; next: string } }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-rp-gray-200">
      <p className="text-xs text-rp-gray-400">
        {labels.page} {page} {labels.of} {totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-rp-gray-200 text-rp-gray-600 hover:bg-rp-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {labels.previous}
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-rp-gray-200 text-rp-gray-600 hover:bg-rp-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {labels.next}
        </button>
      </div>
    </div>
  );
}

export default function InvestorListClient({
  investors,
  investorTotal,
  investorPage,
  invitations,
  invitationTotal,
  invitationPage,
  inviteFilter,
  inviteCounts,
  locale,
  tab,
  pageSize,
}: InvestorListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const t = useTranslations('admin.investors');
  const tc = useTranslations('common');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filterLabels: Record<InviteFilter, string> = {
    all: t('allInvitations'),
    pending: t('pending'),
    accepted: t('accepted'),
    expired: t('expired'),
  };

  const investorTotalPages = Math.ceil(investorTotal / pageSize);
  const invitationTotalPages = Math.ceil(invitationTotal / pageSize);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleTabChange = (newTab: Tab) => {
    updateParams({ tab: newTab });
  };

  const handleInvestorPage = (p: number) => {
    updateParams({ ip: String(p) });
  };

  const handleInvitationPage = (p: number) => {
    updateParams({ vp: String(p) });
  };

  const handleFilterChange = (f: InviteFilter) => {
    updateParams({ status: f, vp: '1' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDeleteInvitation'))) return;
    setDeleting(id);
    await supabase.from('terminal_invite_tokens').delete().eq('id', id);
    setDeleting(null);
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[24px] font-bold text-rp-navy">{t('title')}</h1>
        <Link href={`/${locale}/admin/investors/invite`}>
          <Button variant="gold">{t('inviteNew')}</Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-rp-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => handleTabChange('investors')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'investors'
              ? 'bg-white text-rp-navy shadow-sm'
              : 'text-rp-gray-500 hover:text-rp-gray-700'
          }`}
        >
          {t('activeInvestors')}
          <span className="ml-1.5 text-xs text-rp-gray-400">{investorTotal}</span>
        </button>
        <button
          onClick={() => handleTabChange('invitations')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'invitations'
              ? 'bg-white text-rp-navy shadow-sm'
              : 'text-rp-gray-500 hover:text-rp-gray-700'
          }`}
        >
          {t('invitations')}
          <span className="ml-1.5 text-xs text-rp-gray-400">{inviteCounts.all}</span>
        </button>
      </div>

      {/* Active Investors Tab */}
      {tab === 'investors' && (
        investorTotal === 0 ? (
          <div className="bg-white rounded-2xl border border-rp-gray-200 p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-rp-gray-100 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="7" r="3.5" stroke="#94A3B8" strokeWidth="1.5" />
                <path d="M2 19c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M19 8v6M22 11h-6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-rp-gray-500 text-sm mb-1">{t('noInvestorsYet')}</p>
            <p className="text-rp-gray-400 text-xs">{t('inviteFirst')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rp-gray-200">
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('name')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('email')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('company')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('joined')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('lastActive')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('dealsViewed')}</th>
                  <th className="text-right text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {investors.map((investor) => (
                  <tr
                    key={investor.id}
                    onClick={() => setSelectedId(investor.id === selectedId ? null : investor.id)}
                    className={`border-b border-rp-gray-100 last:border-b-0 cursor-pointer transition-colors ${
                      investor.id === selectedId ? 'bg-rp-gold/5' : 'hover:bg-rp-gray-100'
                    } ${!investor.is_active ? 'bg-rp-gray-50' : ''}`}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-rp-navy">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={!investor.is_active ? 'line-through text-rp-gray-400' : ''}>
                          {investor.full_name}
                        </span>
                        {!investor.is_active && (
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-rp-gray-500 bg-rp-gray-100 rounded px-1.5 py-0.5">
                            Revoked
                          </span>
                        )}
                        {investor.parent_investor_id && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#0E3470] bg-[#EEF2FF] border border-[#C7D2FE] rounded px-1.5 py-0.5"
                            title={investor.parent_name ? `Team member of ${investor.parent_name}` : 'Team member'}
                          >
                            Team{investor.parent_name ? ` · ${investor.parent_name.split(' ')[0]}` : ''}
                          </span>
                        )}
                        {investor.parent_inactive && (
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] rounded px-1.5 py-0.5">
                            Parent inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{investor.email}</td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{investor.company_name ?? '\u2014'}</td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{formatDate(investor.created_at)}</td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{formatRelativeTime(investor.last_active_at, t)}</td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{investor.deals_viewed}</td>
                    <td className="px-5 py-3.5 text-right text-sm" onClick={(e) => e.stopPropagation()}>
                      <SetActiveButton investorId={investor.id} isActive={investor.is_active} onDone={() => router.refresh()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={investorPage} totalPages={investorTotalPages} onPageChange={handleInvestorPage} labels={{ page: tc('page'), of: tc('of'), previous: tc('previous'), next: tc('next') }} />
          </div>
        )
      )}

      {/* Active tab action button component defined below */}

      {/* Invitations Tab */}
      {tab === 'invitations' && (
        <>
          {/* Filter Dropdown */}
          <div className="flex items-center gap-3 mb-4">
            <label htmlFor="invite-filter" className="text-xs font-medium text-rp-gray-500">
              {t('status')}:
            </label>
            <select
              id="invite-filter"
              value={inviteFilter}
              onChange={(e) => handleFilterChange(e.target.value as InviteFilter)}
              className="px-3 py-1.5 text-sm border border-rp-gray-300 rounded-lg text-rp-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors"
            >
              {(['all', 'pending', 'accepted', 'expired'] as InviteFilter[]).map((f) => (
                <option key={f} value={f}>
                  {filterLabels[f]} ({inviteCounts[f]})
                </option>
              ))}
            </select>
          </div>

          {invitationTotal === 0 ? (
            <div className="bg-white rounded-2xl border border-rp-gray-200 p-12 text-center">
              <p className="text-rp-gray-500 text-sm mb-1">{t('noInvitations', { status: inviteFilter === 'all' ? '' : inviteFilter })}</p>
              <p className="text-rp-gray-400 text-xs">
                {inviteFilter === 'all'
                  ? t('inviteSomeone')
                  : t('noInvitations', { status: inviteFilter })}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rp-gray-200">
                    <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('email')}</th>
                    <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('role')}</th>
                    <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('status')}</th>
                    <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('sent')}</th>
                    <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('expires')}</th>
                    <th className="text-right text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => {
                    const status = getInviteStatus(inv);
                    return (
                      <tr key={inv.id} className="border-b border-rp-gray-100 last:border-b-0 hover:bg-rp-gray-50 transition-colors">
                        <td className="px-5 py-3.5 text-sm font-medium text-rp-navy">{inv.email}</td>
                        <td className="px-5 py-3.5 text-sm text-rp-gray-600 capitalize">{inv.role}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}>
                            {t(status)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-rp-gray-600">{formatDate(inv.created_at)}</td>
                        <td className="px-5 py-3.5 text-sm text-rp-gray-600">
                          {status === 'accepted'
                            ? formatDate(inv.accepted_at!)
                            : formatDate(inv.expires_at)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleDelete(inv.id)}
                            disabled={deleting === inv.id}
                            className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                          >
                            {deleting === inv.id ? tc('deleting') : tc('delete')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={invitationPage} totalPages={invitationTotalPages} onPageChange={handleInvitationPage} labels={{ page: tc('page'), of: tc('of'), previous: tc('previous'), next: tc('next') }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SetActiveButton({
  investorId,
  isActive,
  onDone,
}: {
  investorId: string;
  isActive: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const nextActive = !isActive;
    const verb = nextActive ? 'reactivate' : 'revoke';
    if (!confirm(`Are you sure you want to ${verb} this user's access?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/investors/${investorId}/set-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`text-xs font-semibold transition-colors disabled:opacity-50 ${
        isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'
      }`}
    >
      {busy ? '…' : isActive ? 'Revoke' : 'Reactivate'}
    </button>
  );
}
