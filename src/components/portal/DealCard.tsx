'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCountdown, getUrgencyLevel } from '@/lib/hooks/useCountdown';
import { Link } from '@/i18n/navigation';
import { formatPriceCompact, formatPercent, formatDSCR, formatPrice } from '@/lib/utils/format';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';
import { friendlyFetchError } from '@/lib/utils/friendly-error';
import DealNotepad from '@/components/portal/DealNotepad';

interface DealCardProps {
  deal: DealCardData;
  locale: string;
  index?: number;
  previewMode?: boolean;
}

export default function DealCard({ deal, locale, index, previewMode = false }: DealCardProps) {
  const t = useTranslations('portal.dealCard');
  const tPt = useTranslations('portal.propertyTypes');
  const [watched, setWatched] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const [watchError, setWatchError] = useState<string | null>(null);

  useEffect(() => {
    if (!watchError) return;
    const t = setTimeout(() => setWatchError(null), 3500);
    return () => clearTimeout(t);
  }, [watchError]);

  const ddCountdown = useCountdown(deal.dd_deadline);
  const closeCountdown = useCountdown(deal.close_deadline ?? null);
  const isAssignedStatus = deal.status === 'assigned';
  const isClosedStatus = deal.status === 'closed';
  const isAssigned = isAssignedStatus || isClosedStatus;
  const urgency = isAssigned
    ? 'assigned'
    : !deal.dd_deadline
    ? 'tba'
    : getUrgencyLevel(deal.dd_deadline);

  // Build the "Due Diligence: N days" / "Closing: N days" line. DD takes
  // priority while it's still active; once it's past, show Closing.
  const timelinePhase: 'dd' | 'closing' | null = (() => {
    if (deal.dd_deadline && !ddCountdown.isExpired) return 'dd';
    if (deal.close_deadline && !closeCountdown.isExpired) return 'closing';
    return null;
  })();

  const infReturn = deal.fully_financed
    ? (deal.has_positive_cash_flow ? '∞' : 'N/A')
    : null;

  const address = [deal.address, deal.city, deal.state].filter(Boolean).join(', ');

  return (
    <Link
      href={previewMode ? `/admin/deals/${deal.id}/preview` : `/portal/deals/${deal.id}`}
      locale={locale}
      className="group relative block opacity-0 animate-fade-up"
      style={{ animationDelay: `${(index || 0) * 120}ms` }}
    >
      <div
        className={[
          'relative bg-white rounded-[14px] overflow-hidden',
          'border border-transparent',
          'rp-card-shadow',
          'group-hover:-translate-y-2 group-hover:rp-card-shadow-hover',
          'transition-all duration-300',
        ].join(' ')}
      >
        {/* ── Header: Name + Address ── */}
        <div className="px-[22px] pt-[18px] pb-3">
          <h3 className="text-[20px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)] leading-tight tracking-[-0.01em] truncate">
            {deal.name}
          </h3>
          {address && (
            <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">
              {address}
            </p>
          )}
        </div>

        {/* ── Photo ── */}
        <div className="h-[200px] relative overflow-hidden">
          {deal.photo_url ? (
            <img
              src={deal.photo_url}
              alt={deal.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0E3470 40%, #1D5FB8 100%)' }}
            >
              <svg
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={{ color: 'rgba(255,255,255,0.20)' }}
              >
                <path d="M3 21V7l9-4 9 4v14H3zm2-2h5v-4h4v4h5V8.3l-7-3.1L5 8.3V19zm2-6h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8-4h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z" />
              </svg>
            </div>
          )}

          {/* Top-right watch icon — hidden in admin preview (read-only) */}
          {!previewMode && (
            <div
              role="button"
              aria-label="Watch"
              className="absolute top-1 right-1 z-[3] p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (watchLoading) return;
                setWatchLoading(true);
                setWatchError(null);
                try {
                  const method = watched ? 'DELETE' : 'POST';
                  const res = await fetch(`/api/deals/${deal.id}/watch`, { method });
                  if (res.ok) setWatched(!watched);
                  else setWatchError('Couldn’t save. Try again.');
                } catch (err) {
                  console.error('watch toggle failed:', err);
                  setWatchError(friendlyFetchError(err, 'Couldn’t save. Try again.'));
                } finally {
                  setWatchLoading(false);
                }
              }}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shadow-md transition-all ${
                watchLoading ? 'opacity-60 pointer-events-none' : ''
              } ${watched ? 'bg-[#BC9C45]' : 'bg-white/80 backdrop-blur-sm hover:bg-white'}`}>
                {watchLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={watched ? 'white' : 'none'} stroke={watched ? 'white' : '#6B7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </div>
              {watchError && (
                <div className="absolute top-full right-0 mt-1 whitespace-nowrap rounded-md bg-[#DC2626] px-2 py-1 text-[10px] font-semibold text-white shadow-md z-[4]">
                  {watchError}
                </div>
              )}
            </div>
          )}

          {/* Notepad icon — stacked below the watch icon */}
          {!previewMode && (
            <div
              className="absolute top-12 right-1 z-[3] p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <DealNotepad
                dealId={deal.id}
                dealName={deal.name}
                variant="card"
                initialContent={deal.note_content ?? ''}
                initialUpdatedAt={deal.note_updated_at ?? undefined}
              />
            </div>
          )}

          {/* Quarter badge */}
          {deal.quarter_release && (
            <div className="absolute top-3 left-3 z-[2]">
              <span className="bg-[#0E3470]/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
                {deal.quarter_release}
              </span>
            </div>
          )}

          {/* ── Assigned photo-only overlay ── */}
          {isAssignedStatus && (
            <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/35 pointer-events-none">
              <span
                className="font-[family-name:var(--font-playfair)] font-extrabold text-[#BC9C45] text-[32px] tracking-[0.15em] uppercase -rotate-[15deg]"
                style={{ textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)' }}
              >
                {t('assigned')}
              </span>
            </div>
          )}
        </div>

        {/* Gold gradient line at photo-body boundary */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#BC9C45]/40 to-transparent" />

        {/* ── Card Body ── */}
        <div style={{ padding: '14px 22px 0' }}>
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="bg-[#0E3470] text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
              {tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type}
            </span>
            {deal.seller_financing && (
              <span
                className="text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #BC9C45 0%, #D4B85A 50%, #BC9C45 100%)',
                }}
              >
                {t('sellerFinancing')}
              </span>
            )}
            {deal.note_sale && (
              <span
                className="text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #7C1D3F 0%, #A33B5C 50%, #7C1D3F 100%)',
                }}
              >
                {t('noteSale')}
              </span>
            )}
          </div>

          {/* Headline metrics: Purchase Price + Equity Required */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[1.8px]">
                {t('purchasePrice')}
              </div>
              <div className="text-[24px] font-bold text-[#0E3470] tabular-nums leading-tight tracking-tight mt-0.5">
                {formatPriceCompact(deal.purchase_price)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[1.8px]">
                {t('equityRequired')}
              </div>
              <div className={`text-[24px] font-bold tabular-nums leading-tight tracking-tight mt-0.5 ${deal.fully_financed ? 'text-[#0B8A4D]' : 'text-[#0E3470]'}`}>
                {deal.fully_financed ? '$0' : formatPriceCompact(deal.equity_required)}
              </div>
            </div>
          </div>

          {/* Secondary metrics: 2 rows × 3 */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-3 mt-4">
            <SecondaryMetric label={t('noi')} value={formatPrice(deal.noi)} />
            <SecondaryMetric label={t('capRate')} value={formatPercent(deal.cap_rate)} />
            <SecondaryMetric
              label={t('irr')}
              value={infReturn ?? formatPercent(deal.irr)}
              highlight={!!infReturn}
              isInfinity={infReturn === '∞'}
            />
            <SecondaryMetric
              label={t('coc')}
              value={infReturn ?? formatPercent(deal.coc)}
              highlight={!!infReturn}
              isInfinity={infReturn === '∞'}
            />
            <SecondaryMetric label={t('dscr')} value={formatDSCR(deal.dscr)} />
            <SecondaryMetric
              label={t('occupancy')}
              value={deal.occupancy ? `${deal.occupancy}%` : '—'}
            />
          </div>

          {/* ── Timeline line ── */}
          {(timelinePhase || isAssigned || urgency === 'tba') && (
            <div className="mt-4 -mx-[22px] px-[22px] py-3 border-t border-[#EEF0F4] flex items-center justify-between">
              {isAssigned ? (
                <span className="text-[13px] font-semibold text-[#BC9C45]">
                  ★ {t('assigned')}
                </span>
              ) : timelinePhase === 'dd' ? (
                <span className="text-[13px] font-medium text-[#0E3470]">
                  {t('ddTimelineLabel')}:{' '}
                  <span className="font-semibold tabular-nums">
                    {t('daysCount', { count: ddCountdown.days })}
                  </span>
                </span>
              ) : timelinePhase === 'closing' ? (
                <span className="text-[13px] font-medium text-[#0E3470]">
                  {t('closingTimelineLabel')}:{' '}
                  <span className="font-semibold tabular-nums">
                    {t('daysCount', { count: closeCountdown.days })}
                  </span>
                </span>
              ) : (
                <span className="text-[13px] font-medium text-[#6B7280]">
                  {t('tba')}
                </span>
              )}
            </div>
          )}
          {!(timelinePhase || isAssigned || urgency === 'tba') && (
            <div className="h-5" />
          )}
        </div>

        {/* ── Closed full-card stamp overlay ── */}
        {isClosedStatus && (
          <div className="absolute inset-0 bg-[rgba(7,9,15,0.88)] rounded-[14px] z-10 flex items-center justify-center pointer-events-none">
            {/* Gold confetti particles */}
            <div className="absolute inset-0 overflow-hidden rounded-[16px]">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute rounded-full bg-[#BC9C45] confetti-fall"
                  style={{
                    width: `${4 + Math.random() * 6}px`,
                    height: `${4 + Math.random() * 6}px`,
                    top: `${10 + Math.random() * 70}%`,
                    left: `${5 + Math.random() * 90}%`,
                    opacity: 0.2 + Math.random() * 0.4,
                    animationDelay: `${Math.random() * 3}s`,
                  }}
                />
              ))}
            </div>
            <div className="animate-stamp-in rotate-[-6deg] border-2 border-[#BC9C45] px-8 py-3 rounded">
              <span className="font-[family-name:var(--font-playfair)] text-4xl font-extrabold text-[#BC9C45] tracking-wider">
                {t('closed')}
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

function SecondaryMetric({
  label,
  value,
  highlight,
  isInfinity,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
  isInfinity?: boolean;
}) {
  return (
    <div>
      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-[1.8px]">
        {label}
      </div>
      <div
        className={`font-semibold tabular-nums leading-none mt-1 ${
          isInfinity ? 'text-[17px] text-[#0B8A4D]' : highlight ? 'text-[14px] text-[#0B8A4D]' : 'text-[14px] text-[#0E3470]'
        }`}
      >
        {value ?? '—'}
      </div>
    </div>
  );
}
