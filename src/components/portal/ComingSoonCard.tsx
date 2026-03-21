'use client';

import { useState } from 'react';
import { useCountdown } from '@/lib/hooks/useCountdown';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

interface ComingSoonCardProps {
  deal: DealCardData;
  index?: number;
}

export default function ComingSoonCard({ deal, index }: ComingSoonCardProps) {
  const [subscribed, setSubscribed] = useState(deal.is_subscribed ?? false);
  const [loading, setLoading] = useState(false);

  const isLoiSigned = deal.status === 'loi_signed';
  const psaTarget = deal.psa_draft_start
    ? new Date(new Date(deal.psa_draft_start).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const countdown = useCountdown(isLoiSigned ? psaTarget : null);

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const method = subscribed ? 'DELETE' : 'POST';
      const res = await fetch(`/api/deals/${deal.id}/subscribe`, { method });
      if (res.ok) {
        setSubscribed(!subscribed);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="group relative block opacity-0 animate-fade-up"
      style={{ animationDelay: `${(index || 0) * 120}ms` }}
    >
      <div className="relative bg-white rounded-[14px] overflow-hidden rp-card-shadow transition-all duration-300 group-hover:-translate-y-1">
        {/* Photo area with frosted overlay */}
        <div className="h-[180px] relative overflow-hidden">
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
            />
          )}
          {/* Frosted overlay */}
          <div className="absolute inset-0 backdrop-blur-[6px] bg-white/20" />

          {/* Status badge */}
          <div className="absolute top-3 left-3 z-[2]">
            <span className={`text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full ${
              isLoiSigned
                ? 'bg-[#BC9C45]/90 backdrop-blur-sm'
                : 'bg-[#0E3470]/90 backdrop-blur-sm'
            }`}>
              {isLoiSigned ? 'LOI SIGNED' : 'COMING SOON'}
            </span>
          </div>

          {/* Lock icon center */}
          <div className="absolute inset-0 flex items-center justify-center z-[1]">
            <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Gold gradient line */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#BC9C45]/40 to-transparent" />

        {/* Card body */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold text-[#BC9C45] uppercase tracking-[2px]">
              {deal.property_type}
            </span>
          </div>
          <h3 className="text-[20px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)] leading-tight tracking-[-0.01em]">
            {deal.name}
          </h3>
          <p className="text-[12px] text-[#6B7280] mt-1">
            {deal.city}, {deal.state}
          </p>

          {deal.teaser_description && (
            <p className="text-[12px] text-[#4B5563] mt-3 leading-relaxed line-clamp-3">
              {deal.teaser_description}
            </p>
          )}

          {/* Blurred metrics placeholder */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {['Purchase', 'Cap Rate', 'IRR'].map((label) => (
              <div key={label}>
                <div className="text-[8px] font-bold text-[#9CA3AF] uppercase tracking-[2px]">{label}</div>
                <div className="text-[14px] font-semibold text-[#D1D5DB] blur-[4px] select-none tabular-nums">
                  {label === 'Purchase' ? '$X.XM' : 'X.X%'}
                </div>
              </div>
            ))}
          </div>

          {/* PSA Countdown (LOI Signed only) */}
          {isLoiSigned && psaTarget && !countdown.isExpired && (
            <div className="mt-4 p-3 bg-[#FDF8ED] border border-[#ECD9A0] rounded-lg">
              <div className="text-[8px] font-bold text-[#BC9C45] uppercase tracking-[2px] mb-1.5">
                PSA DRAFT COUNTDOWN
              </div>
              <div className="flex items-center gap-1">
                {[
                  { value: countdown.days, label: 'D' },
                  { value: countdown.hours, label: 'H' },
                  { value: countdown.minutes, label: 'M' },
                  { value: countdown.seconds, label: 'S' },
                ].map((g, i) => (
                  <div key={g.label} className="flex items-center gap-0.5">
                    {i > 0 && (
                      <span className="text-[12px] font-bold text-[#BC9C45]/40">:</span>
                    )}
                    <span className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-md text-[12px] font-bold tabular-nums text-white bg-[#BC9C45]">
                      {String(g.value).padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subscribe button */}
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className={`mt-4 w-full py-2.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
              subscribed
                ? 'bg-[#BC9C45]/[0.08] border border-[#BC9C45]/20 text-[#BC9C45]'
                : 'bg-transparent border border-[#BC9C45]/30 text-[#BC9C45] hover:bg-[#BC9C45]/5 hover:border-[#BC9C45]/50'
            }`}
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
            ) : subscribed ? (
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Subscribed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                Notify Me
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
