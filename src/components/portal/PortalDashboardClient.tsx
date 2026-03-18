'use client';

import DealCard from '@/components/portal/DealCard';

export interface DealCardData {
  id: string;
  name: string;
  city: string;
  state: string;
  property_type: string;
  purchase_price: number;
  noi: number;
  cap_rate: number;
  irr: number;
  coc: number;
  dscr: number;
  equity_required: number;
  seller_financing: boolean;
  special_terms: string | null;
  dd_deadline: string | null;
  status: string;
  assigned_to: string | null;
  quarter_release: string | null;
  photo_url: string | null;
  viewing_count: number;
  meetings_count: number;
}

interface PortalDashboardClientProps {
  deals: DealCardData[];
  locale: string;
}

export default function PortalDashboardClient({ deals, locale }: PortalDashboardClientProps) {
  const activeCount = deals.filter((d) => d.status === 'published').length;
  const closedCount = deals.filter((d) => d.status === 'assigned' || d.status === 'closed').length;

  // Derive quarter badge from first deal or default
  const quarterLabel =
    deals.find((d) => d.quarter_release)?.quarter_release ?? 'Q1 2026';

  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <h1 className="text-[28px] font-bold text-rp-navy leading-tight">
            Active Opportunities
          </h1>
          <span className="bg-rp-gold-bg text-rp-gold px-3 py-1 rounded-full text-xs font-semibold">
            {quarterLabel}
          </span>
        </div>
        <p className="text-sm text-rp-gray-500">
          {activeCount} active &middot; {closedCount} closed &middot; All under executed PSA &middot; 30-day DD &middot; 30-day close
        </p>
      </div>

      {/* Deal card grid */}
      {deals.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-rp-gray-400 text-lg">No deals available at this time.</p>
          <p className="text-rp-gray-400 text-sm mt-2">Check back soon for new opportunities.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(370px,1fr))] gap-5">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
