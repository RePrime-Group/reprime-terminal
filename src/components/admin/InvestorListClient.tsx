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
  nda_signed: boolean;
  kyc_status: 'none' | 'partial' | 'pending' | 'approved' | 'rejected';
  access_tier: 'investor' | 'marketplace_only';
}

const KYC_BADGE: Record<InvestorRow['kyc_status'], { label: string; cls: string }> = {
  none: { label: '—', cls: 'text-rp-gray-500 bg-rp-gray-100' },
  partial: { label: 'Partial', cls: 'text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A]' },
  pending: { label: 'Pending', cls: 'text-[#9F580B] bg-[#FFF7ED] border border-[#FED7AA]' },
  approved: { label: 'Approved', cls: 'text-[#166534] bg-[#DCFCE7] border border-[#BBF7D0]' },
  rejected: { label: 'Rejected', cls: 'text-[#991B1B] bg-[#FEE2E2] border border-[#FECACA]' },
};

interface EmployeeRow {
  id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'employee';
  company_name: string | null;
  created_at: string;
  last_active_at: string | null;
  is_active: boolean;
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

type Tab = 'investors' | 'employees' | 'invitations';
type InviteFilter = 'all' | 'pending' | 'accepted' | 'expired';
type Role = 'owner' | 'employee' | 'investor';

type TierFilter = 'all' | 'investor' | 'marketplace_only';

interface InvestorListClientProps {
  investors: InvestorRow[];
  investorTotal: number;
  investorPage: number;
  employees: EmployeeRow[];
  employeeTotal: number;
  employeePage: number;
  invitations: InvitationRow[];
  invitationTotal: number;
  invitationPage: number;
  inviteFilter: InviteFilter;
  inviteCounts: Record<InviteFilter, number>;
  locale: string;
  tab: Tab;
  pageSize: number;
  currentUserRole: Role | null;
  currentUserId: string | null;
  tierFilter: TierFilter;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
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
  employees,
  employeeTotal,
  employeePage,
  invitations,
  invitationTotal,
  invitationPage,
  inviteFilter,
  inviteCounts,
  locale,
  tab,
  pageSize,
  currentUserRole,
  currentUserId,
  tierFilter,
}: InvestorListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const t = useTranslations('admin.investors');
  const tc = useTranslations('common');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [tierBusy, setTierBusy] = useState<string | null>(null);

  const filterLabels: Record<InviteFilter, string> = {
    all: t('allInvitations'),
    pending: t('pending'),
    accepted: t('accepted'),
    expired: t('expired'),
  };

  const investorTotalPages = Math.ceil(investorTotal / pageSize);
  const employeeTotalPages = Math.ceil(employeeTotal / pageSize);
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

  const handleEmployeePage = (p: number) => {
    updateParams({ ep: String(p) });
  };

  const handleTierFilter = (value: TierFilter) => {
    // Reset to first page on filter change so the new filter doesn't land on
    // a page that no longer exists.
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'investors');
    params.set('ip', '1');
    if (value === 'all') params.delete('tier');
    else params.set('tier', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleTierChange = async (investorId: string, newTier: 'investor' | 'marketplace_only') => {
    setTierBusy(investorId);
    try {
      const res = await fetch(`/api/admin/investors/${investorId}/set-tier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_tier: newTier }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error ?? 'Failed to change tier.');
        return;
      }
      router.refresh();
    } finally {
      setTierBusy(null);
    }
  };

  const toggleBulk = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBulkAll = () => {
    if (bulkSelected.size === investors.length && investors.length > 0) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(investors.map((i) => i.id)));
    }
  };

  const handleBulkTier = async (newTier: 'investor' | 'marketplace_only') => {
    if (bulkSelected.size === 0 || bulkBusy) return;
    const ids = Array.from(bulkSelected);
    if (!confirm(`Change tier to "${newTier === 'investor' ? 'Full Investor' : 'Marketplace Only'}" for ${ids.length} investor(s)?`)) {
      return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch('/api/admin/investors/bulk-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, access_tier: newTier }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error ?? 'Failed to update tier.');
        return;
      }
      setBulkSelected(new Set());
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
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
          onClick={() => handleTabChange('employees')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === 'employees'
              ? 'bg-white text-rp-navy shadow-sm'
              : 'text-rp-gray-500 hover:text-rp-gray-700'
          }`}
        >
          {t('employees')}
          <span className="ml-1.5 text-xs text-rp-gray-400">{employeeTotal}</span>
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
          <div className="space-y-3">
            {/* Tier filter + bulk actions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-rp-gray-500 uppercase tracking-wider">Tier</span>
                <select
                  value={tierFilter}
                  onChange={(e) => handleTierFilter(e.target.value as TierFilter)}
                  className="text-[12px] font-medium border border-rp-gray-200 rounded-md px-2 py-1.5 text-rp-navy bg-white"
                >
                  <option value="all">All investors</option>
                  <option value="investor">Full investors</option>
                  <option value="marketplace_only">Marketplace only</option>
                </select>
              </div>
              {bulkSelected.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[12px] text-rp-gray-500">
                    {bulkSelected.size} selected
                  </span>
                  <button
                    onClick={() => handleBulkTier('investor')}
                    disabled={bulkBusy}
                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white bg-[#0E3470] hover:bg-[#0B2A5C] disabled:opacity-50"
                  >
                    {bulkBusy ? 'Updating…' : 'Make Full Investor'}
                  </button>
                  <button
                    onClick={() => handleBulkTier('marketplace_only')}
                    disabled={bulkBusy}
                    className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-[#0E7490] border border-[#0E7490]/40 hover:bg-[#ECFDFD] disabled:opacity-50"
                  >
                    {bulkBusy ? 'Updating…' : 'Make Marketplace Only'}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rp-gray-200">
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={bulkSelected.size === investors.length && investors.length > 0}
                      ref={(el) => {
                        if (el) el.indeterminate = bulkSelected.size > 0 && bulkSelected.size < investors.length;
                      }}
                      onChange={toggleBulkAll}
                      aria-label="Select all investors on this page"
                    />
                  </th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('name')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('email')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Tier</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('company')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('joined')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('lastActive')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">NDA</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">KYC</th>
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
                    <td className="px-3 py-3.5 w-8" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={bulkSelected.has(investor.id)}
                        onChange={() => toggleBulk(investor.id)}
                        aria-label={`Select ${investor.full_name}`}
                      />
                    </td>
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
                    <td className="px-5 py-3.5 text-sm" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={investor.access_tier}
                        onChange={(e) => handleTierChange(investor.id, e.target.value as 'investor' | 'marketplace_only')}
                        disabled={tierBusy === investor.id || currentUserRole === null}
                        className="text-[12px] font-medium border border-rp-gray-200 rounded-md px-2 py-1 text-rp-navy bg-white disabled:opacity-50"
                      >
                        <option value="investor">Full Investor</option>
                        <option value="marketplace_only">Marketplace Only</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{investor.company_name ?? '\u2014'}</td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{formatDate(investor.created_at)}</td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{formatRelativeTime(investor.last_active_at, t)}</td>
                    <td className="px-5 py-3.5 text-sm">
                      {investor.nda_signed ? (
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#166534] bg-[#DCFCE7] border border-[#BBF7D0] rounded px-1.5 py-0.5">
                          Signed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-rp-gray-500 bg-rp-gray-100 rounded px-1.5 py-0.5">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-[0.1em] rounded px-1.5 py-0.5 ${KYC_BADGE[investor.kyc_status].cls}`}
                      >
                        {KYC_BADGE[investor.kyc_status].label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{investor.deals_viewed}</td>
                    <td className="px-5 py-3.5 text-right text-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-3">
                        {investor.kyc_status !== 'none' && (
                          <Link
                            href={`/${locale}/admin/investors/${investor.id}/kyc`}
                            className="text-xs font-semibold text-[#0E3470] hover:underline"
                          >
                            Review KYC
                          </Link>
                        )}
                        {currentUserRole === 'owner' && investor.id !== currentUserId && (
                          <ChangeRoleButton
                            userId={investor.id}
                            currentRole="investor"
                            labels={{ changeRole: t('changeRole'), confirm: (role: string) => t('confirmChangeRole', { role }), failed: t('roleChangeFailed'), owner: t('owner'), employee: t('employee'), investor: t('investor') }}
                            onDone={() => router.refresh()}
                          />
                        )}
                        <SetActiveButton investorId={investor.id} isActive={investor.is_active} onDone={() => router.refresh()} />
                        {currentUserRole === 'owner' && investor.id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: investor.id, name: investor.full_name })}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                          >
                            {tc('delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={investorPage} totalPages={investorTotalPages} onPageChange={handleInvestorPage} labels={{ page: tc('page'), of: tc('of'), previous: tc('previous'), next: tc('next') }} />
          </div>
          </div>
        )
      )}

      {/* Employees Tab */}
      {tab === 'employees' && (
        employeeTotal === 0 ? (
          <div className="bg-white rounded-2xl border border-rp-gray-200 p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-rp-gray-100 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="7" r="3.5" stroke="#94A3B8" strokeWidth="1.5" />
                <path d="M2 19c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M19 8v6M22 11h-6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-rp-gray-500 text-sm mb-1">{t('noEmployeesYet')}</p>
            <p className="text-rp-gray-400 text-xs">{t('inviteFirstEmployee')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rp-gray-200">
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('name')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('email')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('role')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('joined')}</th>
                  <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('lastActive')}</th>
                  <th className="text-right text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className={`border-b border-rp-gray-100 last:border-b-0 transition-colors hover:bg-rp-gray-50 ${!emp.is_active ? 'bg-rp-gray-50' : ''}`}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-rp-navy">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={!emp.is_active ? 'line-through text-rp-gray-400' : ''}>{emp.full_name}</span>
                        {!emp.is_active && (
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-rp-gray-500 bg-rp-gray-100 rounded px-1.5 py-0.5">
                            Revoked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{emp.email}</td>
                    <td className="px-5 py-3.5 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                        emp.role === 'owner'
                          ? 'bg-rp-gold/10 text-rp-gold border border-rp-gold/30'
                          : 'bg-rp-navy/10 text-rp-navy border border-rp-navy/20'
                      }`}>
                        {emp.role === 'owner' ? t('owner') : t('employee')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{formatDate(emp.created_at)}</td>
                    <td className="px-5 py-3.5 text-sm text-rp-gray-600">{formatRelativeTime(emp.last_active_at, t)}</td>
                    <td className="px-5 py-3.5 text-right text-sm">
                      <div className="flex items-center justify-end gap-3">
                        {currentUserRole === 'owner' && emp.id !== currentUserId && (
                          <ChangeRoleButton
                            userId={emp.id}
                            currentRole={emp.role}
                            labels={{ changeRole: t('changeRole'), confirm: (role: string) => t('confirmChangeRole', { role }), failed: t('roleChangeFailed'), owner: t('owner'), employee: t('employee'), investor: t('investor') }}
                            onDone={() => router.refresh()}
                          />
                        )}
                        {emp.id !== currentUserId && (
                          <SetActiveButton investorId={emp.id} isActive={emp.is_active} onDone={() => router.refresh()} />
                        )}
                        {currentUserRole === 'owner' && emp.id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ id: emp.id, name: emp.full_name })}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                          >
                            {tc('delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={employeePage} totalPages={employeeTotalPages} onPageChange={handleEmployeePage} labels={{ page: tc('page'), of: tc('of'), previous: tc('previous'), next: tc('next') }} />
          </div>
        )
      )}

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
                    <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">{t('accepted')}</th>
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
                          {inv.accepted_at ? '—' : formatDate(inv.expires_at)}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-rp-gray-600">
                          {inv.accepted_at ? formatDateTime(inv.accepted_at) : '—'}
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

      {deleteTarget && (
        <DeleteUserModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDone={() => {
            setDeleteTarget(null);
            router.refresh();
          }}
          labels={{
            title: t('deleteUserTitle'),
            body: t('deleteUserBody', { name: deleteTarget.name }),
            passwordLabel: t('yourPassword'),
            passwordPlaceholder: t('passwordPlaceholder'),
            cancel: tc('cancel'),
            confirm: t('deleteUserConfirm'),
            deleting: tc('deleting'),
            failed: t('deleteUserFailed'),
            incorrectPassword: t('incorrectPassword'),
          }}
        />
      )}
    </div>
  );
}

function DeleteUserModal({
  target,
  onClose,
  onDone,
  labels,
}: {
  target: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
  labels: {
    title: string;
    body: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    cancel: string;
    confirm: string;
    deleting: string;
    failed: string;
    incorrectPassword: string;
  };
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${target.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? labels.incorrectPassword : labels.failed);
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setError(labels.failed);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-rp-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={submit}>
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-bold text-rp-navy mb-2">{labels.title}</h2>
            <p className="text-sm text-rp-gray-600 mb-4">{labels.body}</p>
            <label className="block text-xs font-semibold text-rp-gray-600 mb-1.5">
              {labels.passwordLabel}
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={labels.passwordPlaceholder}
              className="w-full px-3 py-2 text-sm border border-rp-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold"
              disabled={busy}
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 bg-rp-gray-50 rounded-b-2xl border-t border-rp-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-rp-gray-700 hover:bg-rp-gray-100 rounded-lg disabled:opacity-50 transition-colors"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={busy || !password}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? labels.deleting : labels.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangeRoleButton({
  userId,
  currentRole,
  labels,
  onDone,
}: {
  userId: string;
  currentRole: Role;
  labels: { changeRole: string; confirm: (role: string) => string; failed: string; owner: string; employee: string; investor: string };
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const roleLabel = (r: Role) => r === 'owner' ? labels.owner : r === 'employee' ? labels.employee : labels.investor;

  async function setRole(nextRole: Role) {
    setOpen(false);
    if (nextRole === currentRole) return;
    if (!confirm(labels.confirm(roleLabel(nextRole)))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/set-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) {
        alert(labels.failed);
      } else {
        onDone();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="text-xs font-semibold text-rp-navy hover:text-rp-navy/80 disabled:opacity-50 transition-colors"
      >
        {busy ? '…' : labels.changeRole}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-rp-gray-200 bg-white shadow-lg py-1">
            {(['owner', 'employee', 'investor'] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                disabled={r === currentRole}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  r === currentRole
                    ? 'text-rp-gray-400 bg-rp-gray-50 cursor-default'
                    : 'text-rp-gray-700 hover:bg-rp-gray-50'
                }`}
              >
                {roleLabel(r)}
                {r === currentRole && <span className="ml-1 text-rp-gray-400">(current)</span>}
              </button>
            ))}
          </div>
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
