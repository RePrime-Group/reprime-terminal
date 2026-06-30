'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import DealNotepad from '@/components/portal/DealNotepad';
import type { DealWithDetails } from '@/lib/types/database';

interface Props {
  deal: DealWithDetails;
  locale: string;
  previewMode?: boolean;
  isMarketplaceDeal: boolean;
  expressedInterest: boolean;
  checkingInterest: boolean;
  linkCopied: boolean;
  handleShareDeal: () => void;
  onExpressInterestClick: () => void;
  userNote?: { content: string; updated_at: string } | null;
  /** Source list (?from=…) the investor arrived from; drives the back button. */
  navContext?: string | null;
}

export function TopNavBar({
  deal,
  locale,
  previewMode,
  isMarketplaceDeal,
  expressedInterest,
  checkingInterest,
  linkCopied,
  handleShareDeal,
  onExpressInterestClick,
  userNote,
  navContext,
}: Props) {
  const t = useTranslations('portal.dealDetail');
  const tPt = useTranslations('portal.propertyTypes');
  const router = useRouter();
  const previewTitle = previewMode ? 'Preview mode — read-only' : undefined;

  // Resolve the originating list page from the nav context so the back button
  // returns there explicitly (deep links / cross-entry have no reliable
  // history, so router.back() is only the fallback).
  const backHref = (() => {
    if (previewMode || !navContext) return null;
    if (navContext === 'dashboard') return `/${locale}/portal`;
    if (navContext === 'marketplace') return `/${locale}/portal/marketplace`;
    if (navContext.startsWith('curated:')) {
      return `/${locale}/portal/curated/${navContext.slice('curated:'.length)}`;
    }
    return null;
  })();

  function handleBack() {
    if (backHref) router.push(backHref);
    else router.back();
  }

  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#EEF0F4] shadow-[0_1px_3px_rgba(14,52,112,0.04),0_4px_12px_rgba(14,52,112,0.02)]">
      <div className="h-[64px] flex items-center px-4 md:px-8">
        <button
          onClick={handleBack}
          className="hover:bg-[#F7F8FA] rounded-full p-2 transition mr-3 group"
          aria-label="Back to portal"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#9CA3AF] group-hover:text-[#0E3470] transition-colors"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
        </button>
        <div className="hidden md:block h-5 w-px bg-[#EEF0F4] mr-4" />
        <div className="flex-1 min-w-0">
          <h1 className="font-[family-name:var(--font-playfair)] text-[18px] font-semibold text-[#0E3470] truncate">
            {deal.name}
          </h1>
          <p className="text-[10px] text-[#9CA3AF] truncate">
            {deal.city}, {deal.state} &middot; {tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type}
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 ml-2 md:ml-4 shrink-0">
          {!previewMode && (
            <DealNotepad
              dealId={deal.id}
              dealName={deal.name}
              variant="detail"
              initialContent={userNote?.content ?? ''}
              initialUpdatedAt={userNote?.updated_at ?? undefined}
            />
          )}
          {isMarketplaceDeal ? null : deal.status === 'cancelled' ? (
            <span className="px-3 md:px-5 py-2 bg-[#FEF2F2] border border-[#DC2626]/40 text-[#DC2626] text-[11px] md:text-[12px] font-semibold rounded-lg flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="7"/><line x1="10" y1="6" x2="6" y2="10"/><line x1="6" y1="6" x2="10" y2="10"/></svg>
              <span className="hidden sm:inline">{t('dealCancelled')}</span>
              <span className="sm:hidden">✕</span>
            </span>
          ) : deal.status === 'assigned' ? (
            <span className="px-3 md:px-5 py-2 bg-[#FDF8ED] border border-[#BC9C45]/40 text-[#BC9C45] text-[11px] md:text-[12px] font-semibold rounded-lg flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4 4 6-7"/></svg>
              <span className="hidden sm:inline">{t('dealAssigned')}</span>
              <span className="sm:hidden">✓</span>
            </span>
          ) : expressedInterest ? (
            <span className="px-3 md:px-5 py-2 bg-[#ECFDF5] text-[#0B8A4D] text-[11px] md:text-[12px] font-semibold rounded-lg flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#0B8A4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4 4 6-7"/></svg>
              <span className="hidden sm:inline">{t('interestExpressed')}</span>
              <span className="sm:hidden">✓</span>
            </span>
          ) : (
            <button
              onClick={onExpressInterestClick}
              disabled={checkingInterest || previewMode}
              title={previewTitle}
              className="px-3 md:px-5 py-2 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[11px] md:text-[12px] font-semibold rounded-lg transition-colors shadow-[0_2px_6px_rgba(188,156,69,0.25)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {t('expressInterest')}
            </button>
          )}
          <div className="relative">
            <button
              onClick={handleShareDeal}
              className="px-3 md:px-5 py-2 bg-white hover:bg-[#F7F8FA] text-[#0E3470] border border-[#0E3470]/20 text-[11px] md:text-[12px] font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              {t('shareDeal')}
            </button>
            {linkCopied && (
              <div className="absolute top-full right-0 mt-2 z-50 px-3 py-2 bg-[#0E3470] text-white text-[11px] font-semibold rounded-lg shadow-[0_4px_12px_rgba(14,52,112,0.25)] flex items-center gap-1.5 whitespace-nowrap">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12l5 5L21 7" />
                </svg>
                {t('dealLinkCopied')}
              </div>
            )}
          </div>
          <div className="hidden md:block h-4 w-px bg-[#EEF0F4]" />
          <span className="hidden md:inline text-[9px] font-semibold tracking-[2px] uppercase text-[#9CA3AF]">
            {t('confidential')}
          </span>
          <div className="hidden md:block h-4 w-px bg-[#EEF0F4]" />
          <div className="hidden md:flex w-8 h-8 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded-lg items-center justify-center shadow-[0_2px_6px_rgba(188,156,69,0.2)]">
            <span className="text-white text-[11px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
          </div>
        </div>
      </div>
    </div>
  );
}
