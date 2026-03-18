'use client';

import { Fragment } from 'react';
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

  // Build subtitle
  const subtitleParts: string[] = [`${deal.city}, ${deal.state}`];
  if (deal.square_footage) subtitleParts.push(formatSqFt(deal.square_footage));
  if (deal.units) subtitleParts.push(`${deal.units} Units`);
  if (deal.class_type) subtitleParts.push(`Class ${deal.class_type}`);
  const subtitle = subtitleParts.join(' \u00B7 ');

  const metrics = [
    { label: 'PURCHASE', value: formatPriceCompact(deal.purchase_price), highlight: false },
    { label: 'NOI', value: formatPriceCompact(deal.noi), highlight: false },
    { label: 'CAP RATE', value: formatPercent(deal.cap_rate), highlight: false },
    { label: 'IRR', value: formatPercent(deal.irr), highlight: true },
    { label: 'CoC', value: formatPercent(deal.coc), highlight: true },
    { label: 'DSCR', value: formatDSCR(deal.dscr), highlight: false },
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
          'relative bg-white rounded-[16px] overflow-hidden',
          'border-t-[2px] border-t-[#BC9C45]',
          'border border-[#EEF0F4]',
          'shadow-[0_1px_3px_rgba(14,52,112,0.04),0_8px_24px_rgba(14,52,112,0.03)]',
          'group-hover:-translate-y-1.5 group-hover:shadow-[0_8px_40px_rgba(14,52,112,0.1),0_0_0_1px_rgba(188,156,69,0.3)]',
          'transition-all duration-300',
        ].join(' ')}
      >
        {/* ── Photo Area ── */}
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
              {/* Geometric gold grid overlay */}
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(188,156,69,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(188,156,69,0.3) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />
              {/* Gold building icon */}
              <svg
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-[#BC9C45]/20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M3 21V7l9-4 9 4v14H3zm2-2h5v-4h4v4h5V8.3l-7-3.1L5 8.3V19zm2-6h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8-4h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z" />
              </svg>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/[0.5]" />

          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            <span className="bg-[#0E3470]/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
              {deal.property_type}
            </span>
            {deal.seller_financing && (
              <span className="bg-[#BC9C45] text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full">
                Seller Financing
              </span>
            )}
          </div>

          {/* Top-right scarcity badge */}
          <div className="absolute top-3 right-3">
            <span className="gold-shimmer text-white text-[10px] font-semibold px-3 py-[5px] rounded-full">
              Limited Release
            </span>
          </div>

          {/* Social proof bar */}
          <div className="absolute bottom-0 inset-x-0 bg-black/50 backdrop-blur-sm px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0B8A4D] countdown-pulse" />
              <span className="text-[10px] text-white/80">
                {deal.viewing_count} Terminal members viewing
              </span>
            </div>
            <span className="text-[10px] text-white/80">
              {deal.meetings_count} meetings booked
            </span>
          </div>
        </div>

        {/* ── Gold accent divider ── */}
        <div className="h-px bg-gradient-to-r from-[#BC9C45]/0 via-[#BC9C45]/25 to-[#BC9C45]/0" />

        {/* ── Card Body ── */}
        <div className="px-[22px] pt-[16px] pb-0">
          {/* Deal name */}
          <h3 className="text-[19px] font-bold text-[#0E3470] font-[family-name:var(--font-bodoni)] leading-tight truncate">
            {deal.name}
          </h3>

          {/* Subtitle */}
          <p className="text-[11px] text-[#9CA3AF] mt-1 truncate">
            {subtitle}
          </p>

          {/* Metrics grid */}
          <div className="mt-4 grid grid-cols-3 gap-x-5 gap-y-3">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="data-label">{m.label}</div>
                <div
                  className={`text-[15px] font-bold tabular-nums ${
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
            <div className="data-label">EQUITY REQUIRED</div>
            <div className="text-[22px] font-extrabold text-[#0E3470] tracking-tight leading-tight">
              {formatPrice(deal.equity_required)}
            </div>
          </div>

          {/* Special terms */}
          {hasSpecialTerms && (
            <div className="mt-2.5">
              <span className="inline-block bg-[#FDF8ED] text-[#BC9C45] text-[11px] font-semibold px-3 py-1.5 rounded-full border border-[#ECD9A0]">
                {deal.special_terms}
              </span>
            </div>
          )}

          {/* ── Countdown bar ── */}
          <div
            className={`mt-4 -mx-[22px] px-[20px] py-[14px] ${urgencyBg} flex items-center justify-between`}
          >
            <span className="data-label" style={{ color: urgencyTextColor }}>
              DD DEADLINE
            </span>

            {isAssigned ? (
              <span
                className="flex items-center gap-1.5 text-[18px] font-extrabold"
                style={{ color: urgencyTextColor }}
              >
                &#9733; ASSIGNED
              </span>
            ) : countdown.isExpired ? (
              <span
                className="text-[18px] font-extrabold"
                style={{ color: urgencyTextColor }}
              >
                EXPIRED
              </span>
            ) : (
              <div className="flex items-center gap-1">
                {[
                  { value: countdown.days, label: 'D' },
                  { value: countdown.hours, label: 'H' },
                  { value: countdown.minutes, label: 'M' },
                  { value: countdown.seconds, label: 'S' },
                ].map((g, i) => (
                  <Fragment key={g.label}>
                    {i > 0 && (
                      <span
                        className="text-xs opacity-30"
                        style={{ color: urgencyTextColor }}
                      >
                        &middot;
                      </span>
                    )}
                    <span
                      className="inline-flex items-center justify-center w-[30px] h-[28px] rounded-[4px] text-[17px] font-extrabold tabular-nums"
                      style={{
                        backgroundColor: `${urgencyTextColor}10`,
                        color: urgencyTextColor,
                      }}
                    >
                      {String(g.value).padStart(2, '0')}
                    </span>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Assigned / Closed Overlay ── */}
        {isAssigned && (
          <div className="absolute inset-0 bg-[rgba(7,9,15,0.88)] rounded-[16px] z-10 flex items-center justify-center pointer-events-none">
            {/* Confetti */}
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
            <div className="rotate-[-6deg] border-2 border-[#BC9C45] px-8 py-3 rounded">
              <span className="font-[family-name:var(--font-bodoni)] text-4xl font-extrabold text-[#BC9C45] tracking-wider">
                CLOSED
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
