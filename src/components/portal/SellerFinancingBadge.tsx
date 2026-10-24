'use client';

import { useTranslations } from 'next-intl';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';

const fmtPct = (v: number): string =>
  Number.isInteger(v) ? `${v}%` : `${v.toFixed(2).replace(/\.?0+$/, '')}%`;

/**
 * Gold seller-financing chip for deal cards. Shows the carry size and rate
 * ("30% SELLER CARRY @ 4.00%") when known, else the plain label.
 */
export default function SellerFinancingBadge({
  deal,
}: {
  deal: Pick<DealCardData, 'seller_financing' | 'seller_carry_pct' | 'seller_carry_rate'>;
}) {
  const t = useTranslations('portal.dealCard');
  if (!deal.seller_financing) return null;

  const pct = deal.seller_carry_pct ?? 0;
  const rate = deal.seller_carry_rate ?? 0;
  const label = pct > 0
    ? t('sellerCarryBadge', { pct: fmtPct(pct), rate: `${rate.toFixed(2)}%` })
    : t('sellerFinancing');

  return (
    <span
      className="text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full"
      style={{
        background: 'linear-gradient(135deg, #BC9C45 0%, #D4B85A 50%, #BC9C45 100%)',
      }}
    >
      {label}
    </span>
  );
}
