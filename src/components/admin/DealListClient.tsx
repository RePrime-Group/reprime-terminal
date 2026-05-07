'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Input from '@/components/ui/Input';
import { DEAL_STATUS_LABELS } from '@/lib/constants';
import { formatPrice, formatPercent } from '@/lib/utils/format';
import type { DealStatus, PipelineStage } from '@/lib/types/database';
import DealCard from './DealCard';
import DealStatusGroup from './DealStatusGroup';
import DealMessagePanel, { clearThreadCache } from './DealMessagePanel';

export interface LatestMessage {
  message: string;
  created_at: string;
  author_name: string | null;
}

export interface PipelineSummary {
  stage: PipelineStage | null;
  completed: number;
  total: number;
}

export interface DealListItem {
  id: string;
  name: string;
  city: string;
  state: string;
  property_type: string;
  purchase_price: string;
  status: DealStatus;
  dd_deadline: string | null;
  close_deadline: string | null;
  created_at: string;
  noi: string | null;
  square_footage: string | null;
  occupancy: string | null;
  cap_rate: string | null;
  coc: string | null;
  irr: string | null;
  photo_url: string | null;
  latest_message: LatestMessage | null;
  pipeline: PipelineSummary | null;
}

interface DealListClientProps {
  deals: DealListItem[];
  locale: string;
}

const STATUS_GROUP_ORDER: DealStatus[] = [
  'published',
  'marketplace',
  'coming_soon',
  'loi_signed',
  'under_review',
  'draft',
  'assigned',
  'closed',
  'cancelled',
];

type ViewMode = 'cards' | 'table';
const COLLAPSE_KEY = 'admin.dealList.collapsed';
const VIEW_KEY = 'admin.dealList.view';

function isDeadlinePast(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DealListClient({ deals, locale }: DealListClientProps) {
  const t = useTranslations('admin.dealList');
  const tc = useTranslations('common');

  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'cards';
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  });

  // All groups default collapsed (per spec override). Hydrate from localStorage in
  // the lazy initializer so we never trigger a setState-in-effect cascade.
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    STATUS_GROUP_ORDER.forEach((s) => (init[s] = true));
    if (typeof window === 'undefined') return init;
    try {
      const c = localStorage.getItem(COLLAPSE_KEY);
      if (c) return { ...init, ...(JSON.parse(c) as Record<string, boolean>) };
    } catch {
      // ignore
    }
    return init;
  });
  const [openMessageDealId, setOpenMessageDealId] = useState<string | null>(null);

  // Local mirror of `latest_message` so send/edit/delete update the preview in-place
  // without a server round-trip. `null` value means the thread is empty.
  const [messageOverrides, setMessageOverrides] = useState<Record<string, LatestMessage | null>>({});

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsedGroups));
    } catch {
      // localStorage may be unavailable (private mode, quota)
    }
  }, [collapsedGroups]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // localStorage may be unavailable
    }
  }, [view]);

  // Click outside the open panel closes it
  useEffect(() => {
    if (!openMessageDealId) return;
    function onClick(e: MouseEvent) {
      const root = containerRef.current;
      if (!root) return;
      const target = e.target as HTMLElement;
      const panel = root.querySelector(`[data-message-panel-deal="${openMessageDealId}"]`);
      const trigger = root.querySelector(`[data-message-trigger-deal="${openMessageDealId}"]`);
      if (panel?.contains(target)) return;
      if (trigger?.contains(target)) return;
      setOpenMessageDealId(null);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openMessageDealId]);

  const propertyTypes = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => {
      const v = (d.property_type ?? '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [deals]);

  const STATUS_OPTIONS: { value: DealStatus | 'all'; label: string }[] = [
    { value: 'all', label: t('allStatuses') },
    ...STATUS_GROUP_ORDER.map((s) => ({
      value: s,
      label: DEAL_STATUS_LABELS[s] ?? s,
    })),
  ];

  const filteredDeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return deals
      .filter((deal) => {
        if (statusFilter !== 'all' && deal.status !== statusFilter) return false;
        if (typeFilter !== 'all' && deal.property_type !== typeFilter) return false;
        if (q) {
          const searchable = `${deal.name} ${deal.city} ${deal.state}`.toLowerCase();
          if (!searchable.includes(q)) return false;
        }
        return true;
      })
      .map((deal) =>
        deal.id in messageOverrides
          ? { ...deal, latest_message: messageOverrides[deal.id] }
          : deal
      );
  }, [deals, statusFilter, typeFilter, searchQuery, messageOverrides]);

  const grouped = useMemo(() => {
    const map = new Map<DealStatus, DealListItem[]>();
    for (const status of STATUS_GROUP_ORDER) map.set(status, []);
    for (const deal of filteredDeals) {
      const list = map.get(deal.status);
      if (list) list.push(deal);
    }
    return map;
  }, [filteredDeals]);

  function toggleGroup(status: DealStatus) {
    setCollapsedGroups((prev) => ({ ...prev, [status]: !prev[status] }));
  }

  function handleMessageClick(dealId: string) {
    setOpenMessageDealId((prev) => (prev === dealId ? null : dealId));
  }

  function handleLatestChange(dealId: string, latest: LatestMessage | null) {
    setMessageOverrides((prev) => ({ ...prev, [dealId]: latest }));
  }

  function closePanel() {
    if (openMessageDealId) clearThreadCache(openMessageDealId);
    setOpenMessageDealId(null);
  }

  const visibleGroups = STATUS_GROUP_ORDER.filter(
    (s) => (grouped.get(s)?.length ?? 0) > 0
  );

  const totalFiltered = filteredDeals.length;

  return (
    <div ref={containerRef} className="font-[family-name:var(--font-poppins)]">
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
      <div className="flex flex-wrap items-center gap-3 mb-6">
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
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors bg-white"
        >
          <option value="all">{t('allTypes')}</option>
          {propertyTypes.map((pt) => (
            <option key={pt} value={pt}>
              {pt}
            </option>
          ))}
        </select>
        <Input
          placeholder={t('searchDeals')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
        <div className="ml-auto inline-flex rounded-lg border border-rp-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setView('cards')}
            className={`px-3 py-2 text-xs font-semibold transition-colors ${
              view === 'cards' ? 'bg-rp-navy text-white' : 'bg-white text-rp-gray-600 hover:bg-rp-gray-100'
            }`}
          >
            {t('viewCards')}
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={`px-3 py-2 text-xs font-semibold transition-colors ${
              view === 'table' ? 'bg-rp-navy text-white' : 'bg-white text-rp-gray-600 hover:bg-rp-gray-100'
            }`}
          >
            {t('viewTable')}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {totalFiltered === 0 ? (
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
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M9 22V12h6v10" />
              <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
            </svg>
          </div>
          <h3 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-rp-navy mb-1">
            {deals.length === 0 ? t('noDealsYet') : t('noDealFound')}
          </h3>
          {deals.length === 0 && (
            <>
              <p className="text-sm text-rp-gray-400 mb-4">{t('createFirstDeal')}</p>
              <Link href={`/${locale}/admin/deals/new`}>
                <button className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-5 py-2.5 rounded-lg shadow-[0_2px_8px_rgba(188,156,69,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(188,156,69,0.25)] transition-all text-sm">
                  {t('newDeal')}
                </button>
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          {visibleGroups.map((status) => {
            const groupDeals = grouped.get(status) ?? [];
            const collapsed = collapsedGroups[status] ?? false;
            return (
              <DealStatusGroup
                key={status}
                status={status}
                count={groupDeals.length}
                collapsed={collapsed}
                onToggle={() => toggleGroup(status)}
              >
                {view === 'cards' ? (
                  groupDeals.map((deal) => (
                    <div key={deal.id}>
                      <div data-message-trigger-deal={deal.id}>
                        <DealCard
                          deal={deal}
                          locale={locale}
                          onMessageClick={() => handleMessageClick(deal.id)}
                        />
                      </div>
                      {openMessageDealId === deal.id && (
                        <div
                          data-message-panel-deal={deal.id}
                          className="mt-2 bg-white rounded-xl rp-card-shadow overflow-hidden"
                        >
                          <DealMessagePanel
                            dealId={deal.id}
                            onClose={closePanel}
                            onLatestMessageChange={(latest) => handleLatestChange(deal.id, latest)}
                          />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <TableGroup
                    deals={groupDeals}
                    locale={locale}
                    openMessageDealId={openMessageDealId}
                    onMessageClick={handleMessageClick}
                    onLatestChange={handleLatestChange}
                    onClosePanel={closePanel}
                    t={t}
                    tc={tc}
                  />
                )}
              </DealStatusGroup>
            );
          })}
        </>
      )}
    </div>
  );
}

interface TableGroupProps {
  deals: DealListItem[];
  locale: string;
  openMessageDealId: string | null;
  onMessageClick: (dealId: string) => void;
  onLatestChange: (dealId: string, latest: LatestMessage | null) => void;
  onClosePanel: () => void;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
}

function TableGroup({
  deals,
  locale,
  openMessageDealId,
  onMessageClick,
  onLatestChange,
  onClosePanel,
  t,
  tc,
}: TableGroupProps) {
  return (
    <div className="bg-white rounded-2xl rp-card-shadow overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#F7F8FA]">
            <Th>{t('name')}</Th>
            <Th>{t('cityState')}</Th>
            <Th>{t('type')}</Th>
            <Th>{t('price')}</Th>
            <Th>{t('cap')}</Th>
            <Th>{t('coc')}</Th>
            <Th>{t('ddDeadline')}</Th>
            <Th>{tc('actions')}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rp-gray-200">
          {deals.map((deal) => (
            <Fragment key={deal.id}>
              <tr className="hover:bg-[#FAFBFC] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-rp-navy">
                  <Link
                    href={`/${locale}/admin/deals/${deal.id}`}
                    className="hover:text-rp-gold transition-colors"
                  >
                    {deal.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-rp-gray-600">
                  {deal.city}, {deal.state}
                </td>
                <td className="px-4 py-3 text-sm text-rp-gray-600">{deal.property_type}</td>
                <td className="px-4 py-3 text-sm text-rp-gray-700 font-medium">
                  {formatPrice(deal.purchase_price)}
                </td>
                <td className="px-4 py-3 text-sm text-rp-gray-700">
                  {formatPercent(deal.cap_rate)}
                </td>
                <td className="px-4 py-3 text-sm text-rp-gray-700">
                  {formatPercent(deal.coc)}
                </td>
                <td
                  className={`px-4 py-3 text-sm ${
                    isDeadlinePast(deal.dd_deadline)
                      ? 'text-red-600 font-semibold'
                      : 'text-rp-gray-600'
                  }`}
                >
                  {formatDate(deal.dd_deadline)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/${locale}/admin/deals/${deal.id}`}
                      className="text-sm text-rp-navy hover:text-rp-gold font-medium transition-colors"
                    >
                      {tc('edit')}
                    </Link>
                    <a
                      href={`/${locale}/admin/deals/${deal.id}/preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rp-gray-400 hover:text-rp-gold transition-colors"
                      title={t('openInvestorView')}
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
                    <Link
                      href={`/${locale}/admin/deals/${deal.id}/pipeline`}
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
                    <button
                      type="button"
                      data-message-trigger-deal={deal.id}
                      onClick={() => onMessageClick(deal.id)}
                      className="text-rp-gray-400 hover:text-rp-gold transition-colors"
                      title={t('messages')}
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
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              {openMessageDealId === deal.id && (
                <tr data-message-panel-deal={deal.id}>
                  <td colSpan={8} className="p-0 bg-[#FAFBFC]">
                    <DealMessagePanel
                      dealId={deal.id}
                      onClose={onClosePanel}
                      onLatestMessageChange={(latest) => onLatestChange(deal.id, latest)}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-[9px] font-semibold uppercase tracking-[1.5px] text-[#9CA3AF]">
      {children}
    </th>
  );
}
