'use client';

import { useTranslations } from 'next-intl';
import type { DealWithDetails } from '@/lib/types/database';

interface Props {
  deal: DealWithDetails;
}

export function DepositInfoCard({ deal }: Props) {
  const t = useTranslations('portal.dealDetail');
  return (
    <div className="px-4 md:px-8 mt-6">
      <div className="bg-[#FDF8ED] border border-[#ECD9A0] rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="w-10 h-10 rounded-lg bg-[#BC9C45]/10 flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
            <path d="M6 14h4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
          {deal.deposit_amount && (
            <div className="shrink-0">
              <div className="text-[9px] font-semibold tracking-[2px] uppercase text-[#BC9C45]">{t('depositAmount')}</div>
              <div className="text-[18px] font-semibold text-[#0E3470] tabular-nums">{deal.deposit_amount}</div>
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[9px] font-semibold tracking-[2px] uppercase text-[#BC9C45]">{t('heldBy')}</div>
            <div className="text-[13px] sm:text-[15px] font-medium text-[#0E3470] break-words">Bruce J. Smoler, Esq. · Smoler &amp; Associates, P.A. — Florida IOTA Trust Account</div>
          </div>
        </div>
      </div>
    </div>
  );
}
