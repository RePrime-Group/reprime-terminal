'use client';

import { useTranslations } from 'next-intl';
import RePrimeLogo from '@/components/RePrimeLogo';

export function ConfidentialityFooter() {
  const t = useTranslations('portal.dealDetail');
  return (
    <div className="px-4 md:px-8 pb-8 md:pb-10 pt-4">
      <div className="border-t border-[#EEF0F4] pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
        <div className="flex items-center gap-2">
          <RePrimeLogo width={150} variant="navy" />
          <span className="px-1.5 py-[2px] rounded bg-[#0E3470] text-[#FFFFFF] text-[8px] font-bold uppercase tracking-[1.5px] leading-none self-center">
            Beta
          </span>
        </div>
        <p className="text-[10px] text-[#9CA3AF] max-w-[600px] text-right leading-relaxed">
          {t('footerConfidential')}
        </p>
      </div>
    </div>
  );
}
