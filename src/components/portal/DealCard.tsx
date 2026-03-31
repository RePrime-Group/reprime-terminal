'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCountdown, getUrgencyLevel } from '@/lib/hooks/useCountdown';
import { Link } from '@/i18n/navigation';
import { formatPriceCompact, formatPercent, formatDSCR, formatPrice, formatSqFt } from '@/lib/utils/format';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

interface DealCardProps {
  deal: DealCardData;
  locale: string;
  index?: number;
}

export default function DealCard({ deal, locale, index }: DealCardProps) {
  const t = useTranslations('portal.dealCard');
  const tc = useTranslations('portal.countdown');
  const [watched, setWatched] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const countdown = useCountdown(deal.dd_deadline);
  const isAssigned = deal.status === 'assigned' || deal.status === 'closed';
  const urgency = isAssigned ? 'assigned' : getUrgencyLevel(deal.dd_deadline);

  const urgencyMap: Record<string, { bg: string; color: string }> = {
    green:    { bg: 'bg-[#ECFDF5]', color: '#0B8A4D' },
    amber:    { bg: 'bg-[#FFFBEB]', color: '#D97706' },
    red:      { bg: 'bg-[#FEF2F2]', color: '#DC2626' },
    expired:  { bg: 'bg-[#EEF0F4]', color: '#9CA3AF' },
    assigned: { bg: 'bg-[#FDF8ED]', color: '#BC9C45' },
  };

  const { bg: urgencyBg, color: urgencyTextColor } = urgencyMap[urgency] ?? urgencyMap.expired;

  const hasSpecialTerms = deal.special_terms && deal.special_terms !== 'None';
  const hasSocialProof = (deal.viewing_count ?? 0) > 0 || (deal.meetings_count ?? 0) > 0;

  // Build subtitle
  const subtitleParts: string[] = [`${deal.city}, ${deal.state}`];
  if (deal.square_footage) subtitleParts.push(formatSqFt(deal.square_footage));
  if (deal.units) subtitleParts.push(t('units', { count: deal.units }));
  if (deal.class_type) subtitleParts.push(t('classType', { type: deal.class_type }));
  const subtitle = subtitleParts.join(' \u00B7 ');

  const metrics = [
    { label: t('purchase'), value: formatPriceCompact(deal.purchase_price), highlight: false },
    { label: t('noi'), value: formatPriceCompact(deal.noi), highlight: false },
    { label: t('capRate'), value: formatPercent(deal.cap_rate), highlight: false },
    { label: t('irr'), value: formatPercent(deal.irr), highlight: true },
    { label: t('coc'), value: formatPercent(deal.coc), highlight: true },
    { label: t('dscr'), value: formatDSCR(deal.dscr), highlight: false },
  ];

  return (
    <Link
      href={`/portal/deals/${deal.id}`}
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
        {/* ── Photo Area ── */}
        <div className="h-[200px] relative overflow-hidden">
          {deal.photo_url ? (
            <>
              <img
                src={deal.photo_url}
                alt={deal.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Richer bottom-half vignette */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, transparent 30%, rgba(7,9,15,0.3) 60%, rgba(7,9,15,0.7) 100%)',
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0E3470 40%, #1D5FB8 100%)' }}
            >
              {/* Building icon placeholder */}
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

          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-[2]">
            <span className="bg-[#0E3470]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
              {deal.property_type}
            </span>
            {(deal.commitment_count ?? 0) > 0 && (
              <span className="bg-[#DC2626]/90 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-[5px] rounded-full animate-pulse">
                🔥 {deal.commitment_count} Group{(deal.commitment_count ?? 0) > 1 ? 's' : ''} Committed
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
          </div>

          {/* Top-right watch icon */}
          <div
            className="absolute top-3 right-3 z-[3]"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (watchLoading) return;
              setWatchLoading(true);
              try {
                const method = watched ? 'DELETE' : 'POST';
                const res = await fetch(`/api/deals/${deal.id}/watch`, { method });
                if (res.ok) setWatched(!watched);
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
          </div>

          {/* Quarter badge */}
          {deal.quarter_release && (
            <div className="absolute top-3 right-12 z-[2]">
              <span className="bg-[#0E3470]/80 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
                {deal.quarter_release}
              </span>
            </div>
          )}

          {/* Social proof bar — hidden when both counts are 0 */}
          {hasSocialProof && (
            <div className="absolute bottom-0 inset-x-0 z-[2] px-3.5 py-2 flex items-center justify-between backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <div className="flex items-center gap-1.5">
                <span className="live-dot w-1.5 h-1.5 rounded-full bg-[#0B8A4D]" />
                <span className="text-[10px] text-white">
                  {deal.viewing_count} {t('viewingCount')}
                </span>
              </div>
              <span className="text-[10px] text-[#BC9C45]">
                {deal.meetings_count} {t('meetingsBooked')}
              </span>
            </div>
          )}
        </div>

        {/* Gold gradient line at photo-body boundary */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#BC9C45]/40 to-transparent" />

        {/* ── Card Body ── */}
        <div style={{ padding: '18px 22px 20px' }}>
          {/* Row 1: Deal name + TerminalScore */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[22px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)] leading-tight truncate min-w-0 tracking-[-0.01em]">
              {deal.name}
            </h3>
            {/* TerminalScore - removed until scoring algorithm is implemented */}
          </div>

          {/* Row 2: Subtitle */}
          <p className="text-[11px] text-gray-500 mt-1 truncate">
            {subtitle}
          </p>

          {/* Gold divider */}
          <div
            className="my-[14px] h-px opacity-40"
            style={{
              background: 'linear-gradient(to right, #BC9C45, #E5E7EB, #BC9C45)',
            }}
          />

          {/* Metrics grid: 3 cols × 2 rows */}
          <div className="grid grid-cols-3 gap-x-5 gap-y-3">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="text-[8px] font-bold text-gray-400 uppercase tracking-[2px]">
                  {m.label}
                </div>
                <div
                  className={`text-[14px] font-semibold tabular-nums ${
                    m.highlight ? 'text-[#0B8A4D]' : 'text-[#0E3470]'
                  }`}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {/* Equity required */}
          <div className="mt-4">
            <div className="text-[8px] font-bold text-gray-400 uppercase tracking-[2px]">
              {t('equityRequired')}
            </div>
            <div className="text-[22px] font-bold text-[#0E3470] tracking-tight leading-tight tabular-nums">
              {formatPrice(deal.equity_required)}
            </div>
          </div>

          {/* Special terms */}
          {hasSpecialTerms && (
            <div className="mt-3 inline-flex flex-col bg-[#FDF8ED] border border-[#BC9C45] rounded-xl px-3.5 py-1.5">
              <span className="text-[8px] font-bold text-[#BC9C45] uppercase tracking-[1.5px]">
                {t('specialTerms')}
              </span>
              <span className="text-[10px] font-medium text-[#0E3470]">
                {deal.special_terms}
              </span>
            </div>
          )}

          {/* ── Countdown bar ── */}
          <div
            className={`mt-4 -mx-[22px] -mb-[20px] px-[22px] py-[14px] ${urgencyBg} flex items-center justify-between`}
          >
            <div className="flex items-center gap-1.5">
              {urgency === 'red' && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: urgencyTextColor }}
                />
              )}
              <span
                className="text-[8px] font-bold uppercase tracking-[1.5px]"
                style={{ color: urgencyTextColor }}
              >
                {t('ddDeadline')}
              </span>
            </div>

            {isAssigned ? (
              <span
                className="flex items-center gap-1.5 text-[18px] font-extrabold"
                style={{ color: urgencyTextColor }}
              >
                &#9733; {t('assigned')}
              </span>
            ) : countdown.isExpired ? (
              <span
                className="text-[18px] font-extrabold"
                style={{ color: urgencyTextColor }}
              >
                {t('expired')}
              </span>
            ) : (
              <div className="flex items-center gap-0.5">
                {[
                  { value: countdown.days, label: tc('d') },
                  { value: countdown.hours, label: tc('h') },
                  { value: countdown.minutes, label: tc('m') },
                  { value: countdown.seconds, label: tc('s') },
                ].map((g, i) => (
                  <div key={g.label} className="flex items-center gap-0.5">
                    {i > 0 && (
                      <span
                        className="text-[13px] font-bold opacity-40"
                        style={{ color: urgencyTextColor }}
                      >
                        :
                      </span>
                    )}
                    <span
                      className="inline-flex items-center justify-center w-[28px] h-[28px] rounded-md text-[13px] font-extrabold tabular-nums text-white"
                      style={{ backgroundColor: urgencyTextColor }}
                    >
                      {String(g.value).padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Assigned / Closed Overlay ── */}
        {isAssigned && (
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
                CLOSED
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
