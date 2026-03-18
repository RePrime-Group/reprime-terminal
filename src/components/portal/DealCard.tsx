'use client';

import { useCountdown, getUrgencyLevel } from '@/lib/hooks/useCountdown';
import { Link } from '@/i18n/navigation';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

interface DealCardProps {
  deal: DealCardData;
  locale: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `$${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function DealCard({ deal, locale }: DealCardProps) {
  const countdown = useCountdown(deal.dd_deadline);
  const urgency = deal.status === 'assigned' || deal.status === 'closed'
    ? 'assigned'
    : getUrgencyLevel(deal.dd_deadline);

  const isAssigned = deal.status === 'assigned' || deal.status === 'closed';

  const urgencyColors: Record<string, { bg: string; text: string }> = {
    green: { bg: 'bg-rp-green-light', text: 'text-rp-green' },
    amber: { bg: 'bg-rp-amber-light', text: 'text-rp-amber' },
    red: { bg: 'bg-rp-red-light', text: 'text-rp-red' },
    expired: { bg: 'bg-rp-gray-200', text: 'text-rp-gray-400' },
    assigned: { bg: 'bg-rp-gray-200', text: 'text-rp-gray-400' },
  };

  const { bg: urgencyBg, text: urgencyText } = urgencyColors[urgency] ?? urgencyColors.expired;

  const metrics = [
    { label: 'Purchase', value: formatCurrency(deal.purchase_price), highlight: false },
    { label: 'NOI', value: formatCurrency(deal.noi), highlight: false },
    { label: 'Cap Rate', value: `${deal.cap_rate}%`, highlight: false },
    { label: 'IRR', value: `${deal.irr}%`, highlight: true },
    { label: 'CoC', value: `${deal.coc}%`, highlight: true },
    { label: 'DSCR', value: `${deal.dscr}\u00d7`, highlight: false },
  ];

  const hasSpecialTerms = deal.special_terms && deal.special_terms !== 'None';

  return (
    <Link
      href={`/portal/deals/${deal.id}`}
      locale={locale}
      className="group relative block"
    >
      <div
        className={[
          'relative bg-white rounded-2xl border border-rp-gray-200 overflow-hidden',
          'transition-all duration-300 cursor-pointer',
          'hover:-translate-y-1.5 hover:border-rp-gold',
          'hover:shadow-[0_20px_40px_rgba(14,52,112,0.12),0_0_0_1px_rgba(188,156,69,0.3)]',
        ].join(' ')}
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
            <div className="absolute inset-0 bg-gradient-to-br from-rp-navy to-rp-navy/70" />
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/45" />

          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            <span className="bg-rp-navy/90 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
              {deal.property_type}
            </span>
            {deal.seller_financing && (
              <span className="bg-rp-gold text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
                Seller Financing
              </span>
            )}
          </div>

          {/* Top-right scarcity badge */}
          <div className="absolute top-3 right-3">
            <span className="bg-black/60 text-rp-gold text-[10px] px-2.5 py-1 rounded-full font-medium">
              Limited Release
            </span>
          </div>

          {/* Bottom social proof bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rp-green countdown-pulse flex-shrink-0" />
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
        <div className="p-4">
          {/* Deal name & location */}
          <h3 className="text-[19px] font-bold text-rp-navy leading-tight truncate">
            {deal.name}
          </h3>
          <p className="text-[11px] text-rp-gray-400 mt-0.5">
            {deal.city}, {deal.state}
          </p>

          {/* Metrics grid */}
          <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2">
            {metrics.map((m) => (
              <div key={m.label}>
                <p className="text-[10px] text-rp-gray-400 uppercase tracking-wider">
                  {m.label}
                </p>
                <p
                  className={
                    m.highlight
                      ? 'text-sm font-bold text-rp-green'
                      : 'text-sm font-medium text-rp-navy'
                  }
                >
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Equity required */}
          <div className="mt-3">
            <p className="text-[10px] text-rp-gray-400 uppercase tracking-wider">
              Equity Required
            </p>
            <p className="text-[22px] font-extrabold text-rp-navy leading-tight">
              {formatCurrency(deal.equity_required)}
            </p>
          </div>

          {/* Special terms */}
          {hasSpecialTerms && (
            <div className="mt-2">
              <span className="inline-block bg-rp-gold-bg text-rp-gold text-[11px] font-medium px-3 py-1 rounded-full border border-rp-gold-border">
                {deal.special_terms}
              </span>
            </div>
          )}

          {/* Countdown bar */}
          <div className={`mt-3 -mx-4 -mb-4 px-4 py-2.5 ${urgencyBg} flex items-center justify-between`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${urgencyText}`}>
              DD Deadline
            </span>
            {countdown.isExpired || isAssigned ? (
              <span className="text-[20px] font-extrabold text-rp-gray-400">
                {isAssigned ? 'CLOSED' : 'EXPIRED'}
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
          <div className="absolute inset-0 bg-[rgba(7,9,15,0.88)] rounded-2xl z-10 flex items-center justify-center">
            {/* Confetti dots */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
              <span className="absolute w-2 h-2 rounded-full bg-rp-gold/60 top-[12%] left-[18%]" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-rp-gold/40 top-[8%] right-[25%]" />
              <span className="absolute w-2.5 h-2.5 rounded-full bg-rp-gold/50 top-[22%] right-[12%]" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-rp-gold/30 bottom-[30%] left-[10%]" />
              <span className="absolute w-2 h-2 rounded-full bg-rp-gold/50 bottom-[18%] right-[20%]" />
              <span className="absolute w-1 h-1 rounded-full bg-rp-gold/40 top-[40%] left-[30%]" />
              <span className="absolute w-2 h-2 rounded-full bg-rp-gold/35 bottom-[12%] left-[45%]" />
              <span className="absolute w-1.5 h-1.5 rounded-full bg-rp-gold/45 top-[55%] right-[35%]" />
              <span className="absolute w-1 h-1 rounded-full bg-rp-gold/50 top-[15%] left-[55%]" />
              <span className="absolute w-2 h-2 rounded-full bg-rp-gold/30 bottom-[40%] right-[8%]" />
            </div>

            {/* CLOSED stamp */}
            <div className="rotate-[-6deg] border-2 border-rp-gold px-6 py-2 select-none">
              <span className="font-[family-name:var(--font-bodoni)] text-4xl font-extrabold text-rp-gold tracking-wider">
                CLOSED
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
