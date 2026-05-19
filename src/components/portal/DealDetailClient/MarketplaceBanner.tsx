'use client';

import { useTranslations } from 'next-intl';

export function MarketplaceBanner({ interestCount }: { interestCount: number }) {
  const t = useTranslations('portal.marketplace');
  return (
    <div className="bg-gradient-to-r from-[#0E7490] via-[#0F8FA8] to-[#0E7490] text-white">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3 md:py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
        <div className="flex items-center gap-3">
          <span className="bg-white/15 backdrop-blur-sm text-white text-[10px] font-bold tracking-[2px] uppercase px-2.5 py-1 rounded">
            {t('marketplaceBannerTitle')}
          </span>
          <span className="text-[12px] md:text-[13px] font-medium text-white/90">
            {t('marketplaceBannerDesc')}
          </span>
        </div>
        <div className="text-[12px] font-semibold text-white/80 flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {interestCount > 0
            ? `${interestCount} ${interestCount === 1 ? 'investor' : 'investors'} interested`
            : 'No interest yet — be the first'}
        </div>
      </div>
    </div>
  );
}
