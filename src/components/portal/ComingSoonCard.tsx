'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCountdown } from '@/lib/hooks/useCountdown';
import { formatPercent, formatDSCR, formatPrice } from '@/lib/utils/format';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';
import { friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';

interface ComingSoonCardProps {
  deal: DealCardData;
  index?: number;
  previewMode?: boolean;
}

export default function ComingSoonCard({ deal, index, previewMode = false }: ComingSoonCardProps) {
  const t = useTranslations('portal.dealCard');
  const tc = useTranslations('portal.countdown');
  const tp = useTranslations('portal');
  const tPt = useTranslations('portal.propertyTypes');
  const [subscribed, setSubscribed] = useState(deal.is_subscribed ?? false);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Auto-dismiss transient action errors after a few seconds so the card
  // doesn't stay stuck in an error state.
  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => setActionError(null), 4000);
    return () => clearTimeout(t);
  }, [actionError]);

  const isLoiSigned = deal.status === 'loi_signed';
  const psaTarget = deal.psa_draft_start
    ? new Date(new Date(deal.psa_draft_start).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const countdown = useCountdown(isLoiSigned ? psaTarget : null);

  const handleSubscribe = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (previewMode) return;
    setLoading(true);
    setActionError(null);
    try {
      const method = subscribed ? 'DELETE' : 'POST';
      const res = await fetch(`/api/deals/${deal.id}/subscribe`, { method });
      if (res.ok) {
        setSubscribed(!subscribed);
      } else {
        setActionError(await readApiError(res, subscribed
          ? 'Couldn’t turn off notifications. Please try again.'
          : 'Couldn’t save your notification preference. Please try again.'));
      }
    } catch (err) {
      console.error('subscribe toggle failed:', err);
      setActionError(friendlyFetchError(err, 'Couldn’t update notifications. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const address = [deal.address, deal.city, deal.state].filter(Boolean).join(', ');

  return (
    <div
      className="group relative block opacity-0 animate-fade-up"
      style={{ animationDelay: `${(index || 0) * 120}ms` }}
    >
      <div className="relative bg-white rounded-[14px] overflow-hidden border border-transparent rp-card-shadow group-hover:-translate-y-2 group-hover:rp-card-shadow-hover transition-all duration-300">
        {/* Header: Name + Address */}
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

        {/* Photo with frosted overlay + lock */}
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

        {/* Card Body */}
        <div style={{ padding: '12px 20px 12px' }}>
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

          {/* Headline metric: Purchase Price */}
          <div className="mt-3 min-w-0">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.8px]">
              {t('purchasePrice')}
            </div>
            <div className="text-[22px] font-bold text-[#0E3470] tabular-nums leading-tight tracking-[-0.03em] mt-1 truncate">
              {formatPrice(deal.purchase_price)}
            </div>
          </div>

          {/* Secondary metrics: 2 rows x 3 */}
          <div className="grid grid-cols-3 gap-x-3 gap-y-2 mt-3">
            <SecondaryMetric label={t('noi')} value={formatPrice(deal.noi)} />
            <SecondaryMetric label={t('capRate')} value={formatPercent(deal.cap_rate)} />
            <SecondaryMetric label={t('irr')} value={formatPercent(deal.irr)} highlight />
            <SecondaryMetric label={t('coc')} value={formatPercent(deal.coc)} highlight />
            <SecondaryMetric label={t('dscr')} value={formatDSCR(deal.dscr)} />
            <SecondaryMetric
              label={t('occupancy')}
              value={deal.occupancy ? `${deal.occupancy}%` : '—'}
            />
          </div>

          {/* Teaser description */}
          {deal.teaser_description && (
            <p className="text-[12px] text-[#4B5563] mt-3 leading-relaxed line-clamp-3">
              {deal.teaser_description}
            </p>
          )}

          {/* Disclaimer */}
          <p className="mt-3 text-[10px] text-[#9CA3AF] italic leading-relaxed">
            {t('metricsDisclaimer')}
          </p>

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

          {actionError && (
            <div className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[11px] text-[#DC2626]">
              {actionError}
            </div>
          )}

          {/* Subscribe / Commit buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSubscribe}
              disabled={loading || previewMode}
              title={previewMode ? 'Preview mode — read-only' : undefined}
              className={`flex-1 py-2.5 min-h-[44px] rounded-lg text-[12px] font-semibold transition-all duration-200 disabled:cursor-not-allowed ${
                subscribed
                  ? 'bg-[#BC9C45]/[0.08] border border-[#BC9C45]/20 text-[#BC9C45]'
                  : 'bg-transparent border border-[#BC9C45]/30 text-[#BC9C45] hover:bg-[#BC9C45]/5 hover:border-[#BC9C45]/50'
              } ${previewMode ? 'opacity-50' : ''}`}
            >
              {subscribed ? `✓ ${tp('subscribed')}` : tp('notifyMe')}
            </button>
            {isLoiSigned && (
              committed ? (
                <span className="flex-1 py-2.5 rounded-lg text-[12px] font-bold bg-[#ECFDF5] text-[#0B8A4D] text-center flex items-center justify-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#0B8A4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4 4 6-7"/></svg>
                  {t('committed')}
                </span>
              ) : (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (previewMode) return;
                    if (committing) return;
                    setCommitting(true);
                    setActionError(null);
                    try {
                      const res = await fetch(`/api/deals/${deal.id}/commit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'primary' }),
                      });
                      if (res.ok) setCommitted(true);
                      else setActionError(await readApiError(res, 'We couldn’t save your commitment. Please try again.'));
                    } catch (err) {
                      console.error('early commit failed:', err);
                      setActionError(friendlyFetchError(err, 'We couldn’t save your commitment. Please try again.'));
                    } finally {
                      setCommitting(false);
                    }
                  }}
                  disabled={committing || previewMode}
                  title={previewMode ? 'Preview mode — read-only' : undefined}
                  className="flex-1 py-2.5 min-h-[44px] rounded-lg text-[12px] font-bold bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {committing && <div className="w-3 h-3 border-2 border-[#0E3470] border-t-transparent rounded-full animate-spin" />}
                  {committing ? t('committing') : t('commitEarly')}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[1.8px]">
        {label}
      </div>
      <div
        className={`font-semibold tabular-nums leading-none mt-1.5 text-[17px] ${
          highlight ? 'text-[#0B8A4D]' : 'text-[#0E3470]'
        }`}
      >
        {value ?? '—'}
      </div>
    </div>
  );
}
