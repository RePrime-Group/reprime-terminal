'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCountdown, getUrgencyLevel } from '@/lib/hooks/useCountdown';
import { Link } from '@/i18n/navigation';
import { formatPercent, formatDSCR, formatPrice } from '@/lib/utils/format';
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

  const countdown = useCountdown(deal.dd_deadline);
  const isAssignedStatus = deal.status === 'assigned';
  const isClosedStatus = deal.status === 'closed';
  const isMarketplace = deal.status === 'marketplace';
  const isAssigned = isAssignedStatus || isClosedStatus;
  const isTBA = !deal.dd_deadline;
  const urgency = isMarketplace
    ? 'marketplace'
    : isAssigned
    ? 'assigned'
    : isTBA
    ? 'tba'
    : getUrgencyLevel(deal.dd_deadline);

  const urgencyMap: Record<string, { bg: string; color: string }> = {
    green:       { bg: 'bg-[#ECFDF5]', color: '#0B8A4D' },
    amber:       { bg: 'bg-[#FFFBEB]', color: '#D97706' },
    red:         { bg: 'bg-[#FEF2F2]', color: '#DC2626' },
    expired:     { bg: 'bg-[#EEF0F4]', color: '#9CA3AF' },
    tba:         { bg: 'bg-[#EFF4FA]', color: '#0E3470' },
    assigned:    { bg: 'bg-[#FDF8ED]', color: '#BC9C45' },
    marketplace: { bg: 'bg-[#ECFDFD]', color: '#0E7490' },
  };
  const { bg: urgencyBg, color: urgencyTextColor } = urgencyMap[urgency] ?? urgencyMap.expired;

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
        <div className="px-[20px] pt-[14px] pb-2">
          <h3 className="text-[22px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)] leading-tight tracking-[-0.01em] truncate">
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
        <div style={{ padding: '12px 20px 12px' }}>
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="bg-[#0E3470] text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
              {tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type}
            </span>
            {isMarketplace && (
              <span
                className="text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full"
                style={{ background: 'linear-gradient(135deg, #0E7490 0%, #14B8A6 100%)' }}
              >
                {t('marketplaceBadge')}
              </span>
            )}
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
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.8px]">
                {t('purchasePrice')}
              </div>
              <div className="text-[22px] font-bold text-[#0E3470] tabular-nums leading-tight tracking-[-0.03em] mt-1 truncate">
                {formatPrice(deal.purchase_price)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.8px]">
                {t('equityRequired')}
              </div>
              <div className="text-[22px] font-bold text-[#0B8A4D] tabular-nums leading-tight tracking-[-0.03em] mt-1 truncate">
                {deal.fully_financed ? '$0' : formatPrice(deal.equity_required)}
              </div>
            </div>
          </div>

          {/* Secondary metrics: 2 rows × 3 */}
          <div className="grid grid-cols-3 gap-x-3 gap-y-2 mt-3">
            <SecondaryMetric label={t('noi')} value={formatPrice(deal.noi)} />
            <SecondaryMetric label={t('capRate')} value={formatPercent(deal.cap_rate)} />
            <SecondaryMetric
              label={t('irr')}
              value={infReturn ?? formatPercent(deal.irr)}
              highlight
              isInfinity={infReturn === '∞'}
            />
            <SecondaryMetric
              label={t('coc')}
              value={infReturn ?? formatPercent(deal.coc)}
              highlight
              isInfinity={infReturn === '∞'}
            />
            <SecondaryMetric label={t('dscr')} value={formatDSCR(deal.dscr)} />
            <SecondaryMetric
              label={t('occupancy')}
              value={deal.occupancy ? `${deal.occupancy}%` : '—'}
            />
          </div>

          {/* ── Countdown bar ── */}
          <div
            className={`mt-3 -mx-[20px] -mb-[12px] px-[20px] py-[12px] ${urgencyBg} flex items-center justify-between`}
          >
            <div className="flex items-center gap-1.5">
              {urgency === 'red' && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: urgencyTextColor }}
                />
              )}
              {!isAssigned && !isMarketplace && (
                <span
                  className="text-[8px] font-bold uppercase tracking-[1.5px]"
                  style={{ color: urgencyTextColor }}
                >
                  {t('ddDeadline')}
                </span>
              )}
              {isMarketplace && (
                <span
                  className="text-[8px] font-bold uppercase tracking-[1.5px]"
                  style={{ color: urgencyTextColor }}
                >
                  {t('pricingNegotiable')}
                </span>
              )}
            </div>

            {isMarketplace ? (
              <span
                className="flex items-center gap-1.5 text-[14px] font-extrabold"
                style={{ color: urgencyTextColor }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {(deal.interest_count ?? 0) > 0
                  ? t('interested', { count: deal.interest_count ?? 0 })
                  : t('beTheFirstInterested')}
              </span>
            ) : isAssigned ? (
              <span
                className="flex items-center gap-1.5 text-[18px] font-extrabold"
                style={{ color: urgencyTextColor }}
              >
                &#9733; {t('assigned')}
              </span>
            ) : isTBA ? (
              <span
                className="text-[18px] font-extrabold"
                style={{ color: urgencyTextColor }}
              >
                {t('tba')}
              </span>
            ) : countdown.isExpired ? (
              <span
                className="text-[18px] font-extrabold"
                style={{ color: urgencyTextColor }}
              >
                {t('expired')}
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                {[
                  { value: countdown.days, label: t('countdownDays') },
                  { value: countdown.hours, label: t('countdownHrs') },
                  { value: countdown.minutes, label: t('countdownMin') },
                  { value: countdown.seconds, label: t('countdownSec') },
                ].map((g, i) => (
                  <div key={g.label} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <span
                        className="text-[14px] font-bold opacity-50 -mt-2.5"
                        style={{ color: urgencyTextColor }}
                      >
                        :
                      </span>
                    )}
                    <div className="flex flex-col items-center">
                      <span
                        className="inline-flex items-center justify-center w-[32px] h-[30px] rounded-md text-[15px] font-extrabold tabular-nums text-white"
                        style={{ backgroundColor: urgencyTextColor }}
                      >
                        {String(g.value).padStart(2, '0')}
                      </span>
                      <span
                        className="text-[7px] font-semibold uppercase tracking-wide mt-0.5"
                        style={{ color: urgencyTextColor }}
                      >
                        {g.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.8px]">
        {label}
      </div>
      <div
        className={`font-semibold tabular-nums leading-none mt-1.5 ${
          isInfinity ? 'text-[20px] text-[#0B8A4D]' : highlight ? 'text-[17px] text-[#0B8A4D]' : 'text-[17px] text-[#0E3470]'
        }`}
      >
        {value ?? '—'}
      </div>
    </div>
  );
}
