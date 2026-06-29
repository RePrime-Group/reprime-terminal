'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import DealCard from '@/components/portal/DealCard';
import RePrimeLogo from '@/components/RePrimeLogo';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';
import { useDealFilters } from '@/components/portal/deal-filters/useDealFilters';
import DealFilterBar from '@/components/portal/deal-filters/DealFilterBar';
import { useActivityTracker } from '@/lib/hooks/useActivityTracker';

// Statuses a member could already see elsewhere. Anything else on a curated tab
// is only visible through the group assignment → flag it as exclusive.
// Statuses for which we do NOT render the "Exclusive · Off-Market" pill on
// curated cards. investor_only deals only ever appear inside a curated tab —
// the tab context already implies exclusivity, so the pill is visual noise.
const PUBLIC_STATUSES = new Set(['published', 'assigned', 'closed', 'marketplace', 'investor_only']);

export default function CuratedTabClient({
  tabId,
  tabName,
  heroNote,
  deals,
  locale,
  previewMode = false,
}: {
  tabId: string;
  tabName: string;
  heroNote: string | null;
  deals: DealCardData[];
  locale: string;
  /** Admin preview: route cards to the deal preview and skip view logging. */
  previewMode?: boolean;
}) {
  const t = useTranslations('portal.curated');
  const { controller, filteredDeals } = useDealFilters(deals);
  const { trackActivity } = useActivityTracker();

  // Log the tab view once per mount (skipped in admin preview).
  const logged = useRef(false);
  useEffect(() => {
    if (previewMode || logged.current) return;
    logged.current = true;
    trackActivity('curated_deal_viewed', undefined, { tab_id: tabId });
  }, [trackActivity, tabId, previewMode]);

  const hasAnyDeals = deals.length > 0;

  return (
    <div>
      {/* ── Navy hero with gold accent ── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #07090F 0%, #0A1628 35%, #0E3470 70%, #1A4A8A 100%)' }}>
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(188,156,69,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(188,156,69,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="max-w-[1600px] mx-auto relative px-4 pt-8 pb-5 md:px-10 md:pt-12 md:pb-7">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4A843]" />
            <span className="text-[10px] font-medium tracking-[3px] uppercase text-[#D4A843]">
              {t('eyebrow')}
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-[28px] md:text-[42px] font-semibold text-white leading-[1.1] tracking-[-0.02em]">
            {tabName}
          </h1>
          <p className="text-[12px] md:text-[13px] text-white/40 mt-3 font-light tracking-wide leading-relaxed max-w-2xl">
            {heroNote && heroNote.trim() !== '' ? heroNote : t('subtitle')}
          </p>
        </div>
        <div className="h-20" style={{ background: 'linear-gradient(180deg, rgba(26,74,138,0) 0%, #F8F6F1 100%)' }} />
      </div>

      {/* ── Filter bar ── */}
      {hasAnyDeals && <DealFilterBar controller={controller} />}

      {/* ── Content ── */}
      <div className="px-4 py-6 md:px-10 md:py-10">
        {!hasAnyDeals ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center mb-5 shadow-[0_4px_20px_rgba(14,52,112,0.2)]">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7h-9M14 17H5M17 3l3 4-3 4M7 21l-3-4 3-4" />
              </svg>
            </div>
            <p className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-[#0E3470] mb-1.5">
              {t('emptyTitle')}
            </p>
            <p className="text-sm text-[#6B7280] max-w-md">{t('emptyBody')}</p>
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="max-w-[1600px] mx-auto bg-white rounded-lg shadow-sm border border-gray-100 px-6 py-12 text-center">
            <p className="text-[14px] text-gray-400">{t('noMatching')}</p>
          </div>
        ) : (
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
            {filteredDeals.map((deal, i) => {
              const isExclusive = !PUBLIC_STATUSES.has(deal.status);
              return (
                <div key={deal.id} className="flex flex-col gap-2">
                  {isExclusive && (
                    <span
                      className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[1.2px] text-white"
                      style={{ background: 'linear-gradient(135deg, #BC9C45 0%, #D4B85A 50%, #BC9C45 100%)' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      {t('exclusive')}
                    </span>
                  )}
                  <DealCard deal={deal} locale={locale} index={i} previewMode={previewMode} />
                  {deal.match_reason && (
                    <p className="text-[12px] text-[#BC9C45] leading-snug px-1">{deal.match_reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 pb-6 md:px-10 md:pb-10">
        <div className="max-w-[1600px] mx-auto border-t border-[#EEF0F4] pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-2">
            <RePrimeLogo width={150} variant="navy" />
            <span className="px-1.5 py-[2px] rounded bg-[#0E3470] text-[#FFFFFF] text-[8px] font-bold uppercase tracking-[1.5px] leading-none self-center">
              Beta
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
