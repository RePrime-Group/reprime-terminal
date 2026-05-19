'use client';

import { useTranslations } from 'next-intl';
import type { DealWithDetails } from '@/lib/types/database';

interface Props {
  deal: DealWithDetails;
}

export function CancelledDealBanner({ deal }: Props) {
  const t = useTranslations('portal.dealDetail');
  return (
    <div className="px-4 md:px-8 pt-4">
      <div className="bg-[#FEF2F2] border-l-4 border-[#DC2626] rounded-r-lg p-4 md:p-5 flex items-start gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-[#DC2626] uppercase tracking-wider mb-1">
            {t('dealCancelled')}
          </div>
          {(deal as unknown as { cancellation_reason?: string | null }).cancellation_reason ? (
            <p className="text-[14px] text-[#7F1D1D] leading-relaxed">
              {(deal as unknown as { cancellation_reason: string }).cancellation_reason}
            </p>
          ) : (
            <p className="text-[13px] text-[#9F1239]">{t('dealCancelledNoReason')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
