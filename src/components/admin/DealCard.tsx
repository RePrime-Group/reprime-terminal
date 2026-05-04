'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatPriceCompact, formatPercent } from '@/lib/utils/format';
import { STAGE_LABELS } from '@/lib/pipeline/stage-templates';
import type { DealListItem } from './DealListClient';

interface DealCardProps {
  deal: DealListItem;
  locale: string;
  onMessageClick: () => void;
}

const STATUS_BORDER: Record<string, string> = {
  published: '#2D7D46',
  marketplace: '#0EA5E9',
  coming_soon: '#C5A55A',
  loi_signed: '#1B365D',
  under_review: '#D97706',
  draft: '#9CA3AF',
  assigned: '#C5A55A',
  closed: '#2D7D46',
  cancelled: '#DC2626',
};

function daysFromNow(iso: string | null): number | null {
  if (!iso) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMessageStamp(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n).trimEnd() + '…';
}

export default function DealCard({ deal, locale, onMessageClick }: DealCardProps) {
  const t = useTranslations('admin.dealList');
  const tc = useTranslations('common');

  const ddDays = daysFromNow(deal.dd_deadline);
  let ddColor = 'text-rp-gray-600';
  if (ddDays !== null) {
    if (ddDays < 0) ddColor = 'text-red-600 font-semibold';
    else if (ddDays <= 7) ddColor = 'text-[#BC9C45] font-semibold';
  }

  const stageLabel = deal.pipeline?.stage ? STAGE_LABELS[deal.pipeline.stage].toUpperCase() : null;
  const taskTotal = deal.pipeline?.total ?? 0;
  const taskCompleted = deal.pipeline?.completed ?? 0;
  const progressPct = taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;

  const borderColor = STATUS_BORDER[deal.status] ?? '#9CA3AF';

  return (
    <div
      className="bg-white rounded-xl rp-card-shadow hover:shadow-md transition-shadow border-l-4 overflow-hidden"
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex flex-col md:flex-row gap-4 p-4">
        {/* Thumbnail */}
        <div className="w-full md:w-[60px] md:h-[60px] h-32 md:flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-[#0E3470] to-[#1A4A8A] flex items-center justify-center">
          {deal.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.photo_url}
              alt={deal.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white"
            >
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M9 22V12h6v10" />
              <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
            </svg>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Identity */}
              <Link
                href={`/${locale}/admin/deals/${deal.id}`}
                className="text-base font-bold text-rp-navy hover:text-rp-gold transition-colors block truncate"
              >
                {deal.name}
              </Link>
              <p className="text-xs text-rp-gray-500 mt-0.5 truncate">
                {deal.property_type} · {deal.city}, {deal.state}
              </p>

              {/* Metrics */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs">
                <Metric label="PP" value={formatPriceCompact(deal.purchase_price)} />
                <Metric label="NOI" value={formatPriceCompact(deal.noi)} />
                <Metric label={t('cap')} value={formatPercent(deal.cap_rate)} />
                <Metric label={t('coc')} value={formatPercent(deal.coc)} />
              </div>

              {/* Pipeline + Timeline */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                {stageLabel && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-rp-navy">{stageLabel}</span>
                    {taskTotal > 0 && (
                      <>
                        <div className="w-20 h-1.5 bg-rp-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rp-gold transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-rp-gray-500">
                          {taskCompleted}/{taskTotal}
                        </span>
                      </>
                    )}
                  </div>
                )}
                <div className={`text-xs ${ddColor}`}>
                  {t('dd')}:{' '}
                  {deal.dd_deadline ? (
                    <>
                      {formatShortDate(deal.dd_deadline)}{' '}
                      <span className="text-rp-gray-400">
                        ({ddDays! < 0
                          ? t('daysOverdue', { count: Math.abs(ddDays!) })
                          : t('daysRemaining', { count: ddDays! })})
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>

              {/* Latest message preview */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMessageClick();
                }}
                className="mt-2 text-left w-full text-xs text-rp-gray-600 hover:text-rp-navy transition-colors truncate"
              >
                {deal.latest_message ? (
                  <span>
                    💬{' '}
                    <span className="font-medium">
                      {deal.latest_message.author_name ?? t('unknownUser')}
                    </span>
                    : {truncate(deal.latest_message.message, 60)}
                    <span className="text-rp-gray-400">
                      {' '}
                      · {formatMessageStamp(deal.latest_message.created_at)}
                    </span>
                  </span>
                ) : (
                  <span className="text-rp-gray-400">💬 {t('noMessages')}</span>
                )}
              </button>
            </div>

            {/* Actions */}
            <div className="flex md:flex-col gap-2 md:items-end flex-shrink-0">
              <a
                href={`/${locale}/admin/deals/${deal.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-rp-navy hover:text-rp-gold transition-colors px-3 py-1.5 border border-rp-gray-200 rounded-md hover:border-rp-gold whitespace-nowrap"
              >
                {t('openInvestorView')}
              </a>
              <Link
                href={`/${locale}/admin/deals/${deal.id}/pipeline`}
                className="text-xs font-medium text-rp-navy hover:text-rp-gold transition-colors px-3 py-1.5 border border-rp-gray-200 rounded-md hover:border-rp-gold"
              >
                {t('pipeline')}
              </Link>
              <Link
                href={`/${locale}/admin/deals/${deal.id}`}
                className="text-xs font-medium text-rp-navy hover:text-rp-gold transition-colors px-3 py-1.5 border border-rp-gray-200 rounded-md hover:border-rp-gold"
              >
                {tc('edit')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-rp-gray-400 uppercase tracking-wide text-[10px]">{label}</span>
      <span className="font-semibold text-rp-navy">{value}</span>
    </div>
  );
}
