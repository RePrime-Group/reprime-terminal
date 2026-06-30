'use client';

import { useTranslations } from 'next-intl';
import DealCard from '@/components/portal/DealCard';
import type { DealCardData } from '@/components/portal/PortalDashboardClient';
import { useDealFilters } from '@/components/portal/deal-filters/useDealFilters';
import DealFilterBar from '@/components/portal/deal-filters/DealFilterBar';

interface MarketplaceClientProps {
  deals: DealCardData[];
  locale: string;
}

export default function MarketplaceClient({ deals, locale }: MarketplaceClientProps) {
  const t = useTranslations('portal');
  const { controller, filteredDeals } = useDealFilters(deals);

  return (
    <>
      {/* ── Search, Filter & Sort Bar (overlaps the hero gradient fade) ── */}
      <DealFilterBar controller={controller} />

      {/* ── Deal grid ── */}
      <div className="max-w-[1600px] mx-auto px-4 py-6 md:px-10 md:py-10">
        {filteredDeals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-6 py-12 text-center">
            <p className="text-[14px] text-gray-400">{t('noMatchingDeals')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDeals.map((deal, i) => (
              <DealCard key={deal.id} deal={deal} locale={locale} index={i} from="marketplace" />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
