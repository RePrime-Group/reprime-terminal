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

const fadeUpStyle = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up {
  animation: fadeUp 0.5s ease-out forwards;
}
@keyframes countdownPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.4); }
}
.countdown-pulse {
  animation: countdownPulse 2s ease-in-out infinite;
}
@keyframes confettiFall {
  0% { transform: translateY(-10px) rotate(0deg); opacity: 0.6; }
  100% { transform: translateY(10px) rotate(180deg); opacity: 0.2; }
}
.confetti-dot {
  animation: confettiFall 3s ease-in-out infinite alternate;
}
`;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function DealCard({ deal, locale, index }: DealCardProps) {
  const countdown = useCountdown(deal.dd_deadline);
  const isAssigned = deal.status === 'assigned' || deal.status === 'closed';
  const urgency = isAssigned ? 'assigned' : getUrgencyLevel(deal.dd_deadline);

  const urgencyColors: Record<string, { bg: string; text: string }> = {
    green:    { bg: 'bg-[#ECFDF5]', text: 'text-[#0B8A4D]' },
    amber:    { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]' },
    red:      { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]' },
    expired:  { bg: 'bg-[#EEF0F4]', text: 'text-[#9CA3AF]' },
    assigned: { bg: 'bg-[#FDF8ED]', text: 'text-[#BC9C45]' },
  };

  const { bg: urgencyBg, text: urgencyText } = urgencyColors[urgency] ?? urgencyColors.expired;

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
  const subtitle = subtitleParts.join(' · ');

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
    <>
      <style dangerouslySetInnerHTML={{ __html: fadeUpStyle }} />

      <Link
        href={`/portal/deals/${deal.id}`}
        locale={locale}
        className="group relative block"
      >
        <div
          className={[
            'relative bg-white rounded-[16px] border border-[#EEF0F4] overflow-hidden',
            'transition-all duration-300 cursor-pointer',
            'hover:-translate-y-1.5 hover:border-[#BC9C45]',
            'hover:shadow-[0_20px_50px_rgba(14,52,112,0.12),0_0_0_1px_rgba(188,156,69,0.3)]',
            'animate-fade-up opacity-0',
          ].join(' ')}
          style={{ animationDelay: `${(index || 0) * 80}ms` }}
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
              <div className="absolute inset-0 bg-gradient-to-br from-[#0E3470] to-[#1a2744] flex items-center justify-center">
                {/* Building silhouette icon */}
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 64 64"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="opacity-10"
                >
                  <rect x="8" y="20" width="20" height="36" rx="2" stroke="white" strokeWidth="2" />
                  <rect x="36" y="8" width="20" height="48" rx="2" stroke="white" strokeWidth="2" />
                  <rect x="13" y="26" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="21" y="26" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="13" y="34" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="21" y="34" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="13" y="42" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="21" y="42" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="41" y="14" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="49" y="14" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="41" y="22" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="49" y="22" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="41" y="30" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="49" y="30" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="41" y="38" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="49" y="38" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="41" y="46" width="4" height="4" rx="0.5" fill="white" />
                  <rect x="49" y="46" width="4" height="4" rx="0.5" fill="white" />
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
              <span className="bg-black/60 backdrop-blur-sm text-[#BC9C45] text-[10px] font-medium px-2.5 py-1 rounded-full">
                Limited Release
              </span>
            </div>

            {/* Bottom social proof bar */}
            <div className="absolute bottom-0 inset-x-0 bg-black/50 backdrop-blur-sm flex items-center justify-between px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0B8A4D] countdown-pulse flex-shrink-0" />
                <span className="text-[10px] text-white/80">
                  {deal.viewing_count} Terminal members viewing
                </span>
              </div>
              <span className="text-[10px] text-white/80">
                {deal.meetings_count} meetings booked
              </span>
            </div>
          </div>

          {/* ── Card Body ── */}
          <div className="px-[22px] pt-[18px] pb-[20px]">
            {/* Deal name */}
            <h3 className="text-[19px] font-bold text-[#0E3470] leading-tight truncate">
              {deal.name}
            </h3>

            {/* Subtitle */}
            <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">
              {subtitle}
            </p>

            {/* Metrics grid */}
            <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2.5">
              {metrics.map((m) => (
                <div key={m.label}>
                  <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wider font-medium">
                    {m.label}
                  </p>
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
            <div className="mt-3">
              <p className="text-[9px] text-[#9CA3AF] uppercase tracking-wider font-medium">
                Equity Required
              </p>
              <p className="text-[22px] font-extrabold text-[#0E3470] leading-tight">
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
            <div className={`mt-3 -mx-[22px] -mb-[20px] px-[22px] py-2.5 ${urgencyBg} flex items-center justify-between`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${urgencyText}`}>
                DD Deadline
              </span>
              {isAssigned ? (
                <span className="flex items-center gap-1.5 text-[20px] font-extrabold text-[#BC9C45]">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 1.5L11.1 6.3L16.5 6.9L12.45 10.5L13.5 15.75L9 13.2L4.5 15.75L5.55 10.5L1.5 6.9L6.9 6.3L9 1.5Z" fill="#BC9C45" />
                  </svg>
                  ASSIGNED
                </span>
              ) : countdown.isExpired ? (
                <span className="text-[20px] font-extrabold text-[#9CA3AF]">
                  EXPIRED
                </span>
              ) : (
                <span className={`text-[20px] font-extrabold tabular-nums ${urgencyText}`}>
                  {pad(countdown.days)}:{pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
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
                    className={`absolute rounded-full bg-[#BC9C45] ${dot.size} ${dot.opacity} confetti-dot`}
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
    </>
  );
}
