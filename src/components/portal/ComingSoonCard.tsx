'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCountdown } from '@/lib/hooks/useCountdown';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

interface ComingSoonCardProps {
  deal: DealCardData;
  index?: number;
}

export default function ComingSoonCard({ deal, index }: ComingSoonCardProps) {
  const t = useTranslations('portal.dealCard');
  const tc = useTranslations('portal.countdown');
  const tp = useTranslations('portal');
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
              {isLoiSigned ? tp('loiSigned').toUpperCase() : tp('comingSoon').toUpperCase()}
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
            {(['purchase', 'capRate', 'irr'] as const).map((key) => (
              <div key={key}>
                <div className="text-[8px] font-bold text-[#9CA3AF] uppercase tracking-[2px]">{t(key)}</div>
                <div className="text-[14px] font-semibold text-[#D1D5DB] blur-[4px] select-none tabular-nums">
                  {key === 'purchase' ? '$X.XM' : 'X.X%'}
                </div>
              </div>
            ))}
          </div>

          {/* PSA Countdown (LOI Signed only) */}
          {isLoiSigned && psaTarget && !countdown.isExpired && (
            <div className="mt-4 p-3 bg-[#FDF8ED] border border-[#ECD9A0] rounded-lg">
              <div className="text-[8px] font-bold text-[#BC9C45] uppercase tracking-[2px] mb-1.5">
                {tp('psaCountdown').toUpperCase()}
              </div>
              <div className="flex items-center gap-1">
                {[
                  { value: countdown.days, label: tc('d') },
                  { value: countdown.hours, label: tc('h') },
                  { value: countdown.minutes, label: tc('m') },
                  { value: countdown.seconds, label: tc('s') },
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

          {/* Commitment count badge */}
          {(deal.commitment_count ?? 0) > 0 && (
            <div className="mt-4 p-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-center">
              <span className="text-[11px] font-bold text-[#DC2626]">
                🔥 {deal.commitment_count} {(deal.commitment_count ?? 0) > 1 ? t('groups') : t('group')} {t('alreadyCommitted')}
              </span>
            </div>
          )}

          {/* Subscribe / Commit buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className={`flex-1 py-2.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                subscribed
                  ? 'bg-[#BC9C45]/[0.08] border border-[#BC9C45]/20 text-[#BC9C45]'
                  : 'bg-transparent border border-[#BC9C45]/30 text-[#BC9C45] hover:bg-[#BC9C45]/5 hover:border-[#BC9C45]/50'
              }`}
            >
              {subscribed ? `✓ ${tp('subscribed')}` : tp('notifyMe')}
            </button>
            {isLoiSigned && (
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await fetch(`/api/deals/${deal.id}/commit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'primary' }),
                  });
                }}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-bold bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] hover:opacity-90 transition-opacity"
              >
                {t('commitEarly')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

