'use client';

import { useCountdown, getUrgencyLevel } from '@/lib/hooks/useCountdown';
import { Link } from '@/i18n/navigation';
import { formatPriceCompact, formatPercent, formatDSCR, formatPrice } from '@/lib/utils/format';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

interface DealCardProps {
  deal: DealCardData;
  locale: string;
  index?: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function DealCard({ deal, locale, index }: DealCardProps) {
  const countdown = useCountdown(deal.dd_deadline);
  const isAssigned = deal.status === 'assigned' || deal.status === 'closed';
  const urgency = isAssigned ? 'assigned' : getUrgencyLevel(deal.dd_deadline);

  const urgencyColors: Record<string, { bg: string; text: string; accent: string }> = {
    green:    { bg: 'bg-[#ECFDF5]', text: 'text-[#0B8A4D]', accent: '#0B8A4D' },
    amber:    { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', accent: '#D97706' },
    red:      { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', accent: '#DC2626' },
    expired:  { bg: 'bg-[#EEF0F4]', text: 'text-[#9CA3AF]', accent: '#9CA3AF' },
    assigned: { bg: 'bg-[#FDF8ED]', text: 'text-[#BC9C45]', accent: '#BC9C45' },
  };

  const { bg: urgencyBg, text: urgencyText, accent: urgencyAccent } = urgencyColors[urgency] ?? urgencyColors.expired;

  const metrics = [
    { label: 'Purchase', value: formatPriceCompact(deal.purchase_price), highlight: false },
    { label: 'NOI', value: formatPriceCompact(deal.noi), highlight: false },
    { label: 'Cap Rate', value: formatPercent(deal.cap_rate), highlight: false },
    { label: 'IRR', value: formatPercent(deal.irr), highlight: true },
    { label: 'CoC', value: formatPercent(deal.coc), highlight: true },
    { label: 'DSCR', value: formatDSCR(deal.dscr), highlight: false },
  ];

  const hasSpecialTerms = deal.special_terms && deal.special_terms !== 'None';

  // Build subtitle parts
  const subtitleParts: string[] = [`${deal.city}, ${deal.state}`];
  if (deal.square_footage) subtitleParts.push(`${deal.square_footage} SF`);
  if (deal.units) subtitleParts.push(`${deal.units} Units`);
  if (deal.class_type) subtitleParts.push(`Class ${deal.class_type}`);
  const subtitle = subtitleParts.join(' \u00B7 ');

  // Confetti dots for assigned overlay
  const confettiDots = [
    { size: 'w-2 h-2',     opacity: 'opacity-60', top: '10%',  left: '15%',  delay: '0s' },
    { size: 'w-1.5 h-1.5', opacity: 'opacity-40', top: '6%',   left: '72%',  delay: '0.4s' },
    { size: 'w-2.5 h-2.5', opacity: 'opacity-50', top: '20%',  left: '85%',  delay: '0.8s' },
    { size: 'w-1.5 h-1.5', opacity: 'opacity-30', top: '68%',  left: '8%',   delay: '1.2s' },
    { size: 'w-2 h-2',     opacity: 'opacity-50', top: '78%',  left: '78%',  delay: '0.2s' },
    { size: 'w-1 h-1',     opacity: 'opacity-40', top: '38%',  left: '28%',  delay: '1.6s' },
    { size: 'w-2 h-2',     opacity: 'opacity-35', top: '85%',  left: '42%',  delay: '0.6s' },
    { size: 'w-1.5 h-1.5', opacity: 'opacity-45', top: '52%',  left: '62%',  delay: '1.0s' },
    { size: 'w-1 h-1',     opacity: 'opacity-50', top: '14%',  left: '52%',  delay: '1.4s' },
    { size: 'w-2 h-2',     opacity: 'opacity-30', top: '58%',  left: '90%',  delay: '1.8s' },
    { size: 'w-[6px] h-[6px]', opacity: 'opacity-55', top: '44%', left: '5%', delay: '2.0s' },
    { size: 'w-[10px] h-[10px]', opacity: 'opacity-25', top: '30%', left: '48%', delay: '2.2s' },
  ];

  return (
    <Link
      href={`/portal/deals/${deal.id}`}
      locale={locale}
      className="group relative block"
    >
      <div
        className={[
          'relative bg-white rounded-[16px] overflow-hidden',
          'border border-[#EEF0F4] border-t-2 border-t-[#BC9C45]',
          'shadow-[0_1px_3px_rgba(14,52,112,0.04),0_8px_24px_rgba(14,52,112,0.03)]',
          'transition-all duration-300 cursor-pointer',
          'hover:-translate-y-1.5 hover:shadow-[0_8px_40px_rgba(14,52,112,0.1),0_0_0_1px_rgba(188,156,69,0.3)]',
          'opacity-0 animate-fade-up',
        ].join(' ')}
        style={{ animationDelay: `${(index || 0) * 120}ms` }}
      >
        {/* ── Photo Area ── */}
        <div className="relative h-[200px] overflow-hidden">
          {deal.photo_url ? (
            <img
              src={deal.photo_url}
              alt={deal.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#0A1628_0%,#0E3470_40%,#1D5FB8_100%)] flex items-center justify-center">
              {/* Geometric grid overlay */}
              <svg
                className="absolute inset-0 w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <defs>
                  <pattern id={`grid-${deal.id}`} width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#BC9C45" strokeWidth="0.5" opacity="0.08" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#grid-${deal.id})`} />
              </svg>
              {/* Gold building silhouette */}
              <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="opacity-20 relative z-[1]"
              >
                <rect x="8" y="20" width="20" height="36" rx="2" stroke="#BC9C45" strokeWidth="2" />
                <rect x="36" y="8" width="20" height="48" rx="2" stroke="#BC9C45" strokeWidth="2" />
                <rect x="13" y="26" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="21" y="26" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="13" y="34" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="21" y="34" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="13" y="42" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="21" y="42" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="41" y="14" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="49" y="14" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="41" y="22" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="49" y="22" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="41" y="30" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="49" y="30" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="41" y="38" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="49" y="38" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="41" y="46" width="4" height="4" rx="0.5" fill="#BC9C45" />
                <rect x="49" y="46" width="4" height="4" rx="0.5" fill="#BC9C45" />
              </svg>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/[0.45]" />

          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            <span className="bg-[#0E3470]/90 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
              {deal.property_type}
            </span>
            {deal.seller_financing && (
              <span className="bg-[#BC9C45] text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                Seller Financing
              </span>
            )}
          </div>

          {/* Top-right scarcity badge */}
          <div className="absolute top-3 right-3">
            <span className="gold-shimmer text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
              Limited Release
            </span>
          </div>

          {/* Bottom social proof bar */}
          <div className="absolute bottom-0 inset-x-0 bg-black/50 backdrop-blur-sm flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0B8A4D] animate-pulse flex-shrink-0" />
              <span className="text-[10px] text-white/80">
                {deal.viewing_count} Terminal members viewing
              </span>
            </div>
            <span className="text-[10px] text-white/80">
              {deal.meetings_count} meetings booked
            </span>
          </div>
        </div>

        {/* ── Gold accent line ── */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#BC9C45]/20 to-transparent" />

        {/* ── Card Body ── */}
        <div className="px-[22px] pt-[16px] pb-[18px]">
          {/* Deal name */}
          <h3 className="text-[19px] font-extrabold text-[#0E3470] font-[family-name:var(--font-bodoni)] leading-tight truncate">
            {deal.name}
          </h3>

          {/* Subtitle */}
          <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">
            {subtitle}
          </p>

          {/* Metrics grid */}
          <div className="mt-3.5 grid grid-cols-3 gap-x-4 gap-y-3">
            {metrics.map((m) => (
              <div key={m.label}>
                <p className="data-label">{m.label}</p>
                <p
                  className={
                    m.highlight
                      ? 'text-[15px] font-bold text-[#0B8A4D]'
                      : 'text-[15px] font-bold text-[#0E3470]'
                  }
                >
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Equity required */}
          <div className="mt-3.5">
            <p className="data-label">Equity Required</p>
            <p className="text-[22px] font-extrabold text-[#0E3470] tracking-tight">
              {formatPrice(deal.equity_required)}
            </p>
          </div>

          {/* Special terms */}
          {hasSpecialTerms && (
            <div className="mt-2">
              <span className="inline-block bg-[#FDF8ED] text-[#BC9C45] text-[11px] font-medium px-3 py-1 rounded-full border border-[#ECD9A0]">
                {deal.special_terms}
              </span>
            </div>
          )}

          {/* Countdown bar */}
          <div className={`mt-3.5 -mx-[22px] -mb-[18px] px-[18px] py-[14px] ${urgencyBg} flex items-center justify-between`}>
            <span className={`data-label ${urgencyText}`} style={{ color: urgencyAccent }}>
              DD Deadline
            </span>
            {isAssigned ? (
              <span className="flex items-center gap-1.5 text-[18px] font-extrabold text-[#BC9C45]">
                <span className="text-lg">&#9733;</span>
                ASSIGNED
              </span>
            ) : countdown.isExpired ? (
              <span className="text-[18px] font-extrabold text-[#9CA3AF]">
                EXPIRED
              </span>
            ) : (
              <span className="flex items-center gap-0">
                {[
                  { value: pad(countdown.days), unit: 'D' },
                  { value: pad(countdown.hours), unit: 'H' },
                  { value: pad(countdown.minutes), unit: 'M' },
                  { value: pad(countdown.seconds), unit: 'S' },
                ].map((segment, i) => (
                  <span key={segment.unit} className="flex items-center">
                    {i > 0 && (
                      <span className="mx-0.5" style={{ color: urgencyAccent, opacity: 0.4 }}>&middot;</span>
                    )}
                    <span
                      className="inline-flex items-center justify-center w-[28px] h-[26px] rounded text-[18px] font-extrabold tabular-nums"
                      style={{
                        backgroundColor: `${urgencyAccent}15`,
                        color: urgencyAccent,
                      }}
                    >
                      {segment.value}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>

        {/* ── Assigned / Closed Overlay ── */}
        {isAssigned && (
          <div className="absolute inset-0 bg-[rgba(7,9,15,0.88)] rounded-[16px] z-10 flex items-center justify-center">
            {/* Confetti dots */}
            <div className="absolute inset-0 overflow-hidden rounded-[16px] pointer-events-none">
              {confettiDots.map((dot, i) => (
                <span
                  key={i}
                  className={`absolute rounded-full bg-[#BC9C45] ${dot.size} ${dot.opacity} confetti-fall`}
                  style={{
                    top: dot.top,
                    left: dot.left,
                    animationDelay: dot.delay,
                  }}
                />
              ))}
            </div>

            {/* CLOSED stamp */}
            <div className="rotate-[-6deg] border-2 border-[#BC9C45] px-8 py-3 select-none">
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
