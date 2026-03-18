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
  square_footage?: string | null;
  units?: string | null;
  class_type?: string | null;
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
    <div className="px-6 py-8 max-w-[1600px] mx-auto rp-page-texture">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <h1 className="font-[family-name:var(--font-bodoni)] text-[32px] font-bold text-[#0E3470] leading-tight">
            Active Opportunities
          </h1>
          <span className="bg-[#FDF8ED] text-[#BC9C45] px-3 py-1 rounded-full text-xs font-semibold border border-[#ECD9A0]">
            {quarterLabel}
          </span>
        </div>
        <p className="text-sm text-[#6B7280]">
          {activeCount} active &middot; {closedCount} closed &middot; All under executed PSA &middot; 30-day DD &middot; 30-day close
        </p>
      </div>

      {/* Deal card grid */}
      {deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center mb-5">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 21V7L12 3L21 7V21H15V13H9V21H3Z"
                fill="rgba(255,255,255,0.2)"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <rect x="10" y="15" width="4" height="6" rx="0.5" fill="rgba(255,255,255,0.3)" />
              <rect x="7" y="9" width="2.5" height="2.5" rx="0.5" fill="rgba(255,255,255,0.3)" />
              <rect x="14.5" y="9" width="2.5" height="2.5" rx="0.5" fill="rgba(255,255,255,0.3)" />
            </svg>
          </div>
          <p className="font-[family-name:var(--font-bodoni)] text-lg font-semibold text-[#0E3470] mb-1">
            No active opportunities at this time
          </p>
          <p className="text-sm text-[#6B7280]">
            Check back soon for new investment opportunities.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(370px,1fr))] gap-5">
          {deals.map((deal, index) => (
            <DealCard key={deal.id} deal={deal} locale={locale} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
