'use client';

import { useTranslations } from 'next-intl';
import type { DealWithDetails } from '@/lib/types/database';
import { DealPager } from './DealNavigation';
import type { TabKey } from './types';

interface Props {
  deal: DealWithDetails;
  prevDeal?: { id: string; name: string } | null;
  nextDeal?: { id: string; name: string } | null;
  locale: string;
  previewMode?: boolean;
  activeTab: TabKey;
  navContext?: string | null;
}

export function DealHeaderBar({ deal, prevDeal, nextDeal, locale, previewMode, activeTab, navContext }: Props) {
  const t = useTranslations('portal.dealDetail');
  const tc = useTranslations('portal.dealCard');
  const tPt = useTranslations('portal.propertyTypes');
  return (
    <div className="bg-white border-b border-[#EEF0F4] px-4 md:px-8 py-4 md:py-5">
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-[family-name:var(--font-playfair)] text-[22px] md:text-[28px] font-semibold text-[#0E3470] leading-tight tracking-[-0.01em]">
            {deal.name}
          </h2>
          <p className="text-[12px] text-[#9CA3AF] mt-1">
            {deal.city}, {deal.state}
            {deal.square_footage ? ` · ${deal.square_footage} SF` : ''}
            {deal.units ? ` · ${tc('units', { count: deal.units })}` : ''}
            {deal.class_type ? ` · ${tc('classType', { type: deal.class_type })}` : ''}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            {deal.seller_financing && (
              <span className="inline-flex items-center gap-1 bg-[#BC9C45] text-white text-[10px] font-semibold uppercase tracking-[1px] px-2.5 py-1 rounded-md whitespace-nowrap shadow-[0_1px_3px_rgba(188,156,69,0.3)]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('sellerFinancing')}
              </span>
            )}
            <span className="inline-flex items-center bg-white border border-[#EEF0F4] text-[#0E3470] text-[10px] font-semibold uppercase tracking-[1px] px-2.5 py-1 rounded-md whitespace-nowrap">
              {tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type}
            </span>
          </div>
        </div>
        <DealPager
          prevDeal={prevDeal ?? null}
          nextDeal={nextDeal ?? null}
          locale={locale}
          previewMode={previewMode ?? false}
          activeTab={activeTab}
          navContext={navContext ?? null}
          prevLabel={t('previousDeal')}
          nextLabel={t('nextDeal')}
        />
      </div>
    </div>
  );
}
