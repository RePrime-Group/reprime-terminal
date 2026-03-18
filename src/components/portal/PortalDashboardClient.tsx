'use client';

import DealCard from '@/components/portal/DealCard';
import { formatPriceCompact } from '@/lib/utils/format';

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
  const activeDeals = deals.filter((d) => d.status === 'published');
  const closedDeals = deals.filter((d) => d.status === 'assigned' || d.status === 'closed');
  const activeCount = activeDeals.length;
  const closedCount = closedDeals.length;

  // Portfolio summary calculations
  const totalDealVolume = activeDeals.reduce((sum, d) => sum + (d.purchase_price || 0), 0);
  const totalEquity = activeDeals.reduce((sum, d) => sum + (d.equity_required || 0), 0);
  const avgIrr = activeDeals.length > 0
    ? activeDeals.reduce((sum, d) => sum + (d.irr || 0), 0) / activeDeals.length
    : 0;
  const avgCapRate = activeDeals.length > 0
    ? activeDeals.reduce((sum, d) => sum + (d.cap_rate || 0), 0) / activeDeals.length
    : 0;

  // Derive quarter badge from first deal or default
  const quarterLabel =
    deals.find((d) => d.quarter_release)?.quarter_release ?? 'Q1 2026';

  const summaryMetrics = [
    { label: 'TOTAL DEAL VOLUME', value: formatPriceCompact(totalDealVolume), color: 'text-[#0E3470]' },
    { label: 'AGGREGATE EQUITY', value: formatPriceCompact(totalEquity), color: 'text-[#0E3470]' },
    { label: 'AVG. PROJECTED IRR', value: avgIrr > 0 ? `${avgIrr.toFixed(1)}%` : '--', color: 'text-[#0B8A4D]' },
    { label: 'AVG. CAP RATE', value: avgCapRate > 0 ? `${avgCapRate.toFixed(1)}%` : '--', color: 'text-[#0E3470]' },
    { label: 'ACTIVE RELEASES', value: String(activeCount), color: 'text-[#0E3470]' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* ── Hero Section ── */}
      <div className="bg-gradient-to-br from-[#0A1628] via-[#0E3470] to-[#163D7A] relative overflow-hidden">
        {/* Subtle geometric overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(188,156,69,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(188,156,69,0.4) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="relative px-10 py-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0B8A4D] countdown-pulse" />
                <span className="text-[10px] font-semibold tracking-[2px] uppercase text-[#BC9C45]">
                  {quarterLabel} Release
                </span>
              </div>
              <h1 className="font-[family-name:var(--font-bodoni)] text-[38px] font-bold text-white leading-tight">
                Active Opportunities
              </h1>
              <p className="text-[13px] text-white/50 mt-2 font-light">
                {activeCount} active &middot; {closedCount} closed &middot; All under executed PSA &middot; 30-day DD &middot; 30-day close
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white/5 border border-white/10 text-white/60 px-4 py-2 rounded-lg text-[11px] font-medium tracking-wide">
                CONFIDENTIAL
              </span>
            </div>
          </div>

          {/* Portfolio Summary Bar */}
          {activeCount > 0 && (
            <div className="grid grid-cols-5 gap-px bg-white/[0.06] rounded-xl overflow-hidden border border-white/[0.06]">
              {summaryMetrics.map((m) => (
                <div key={m.label} className="bg-[#0E3470]/40 backdrop-blur-sm px-5 py-4">
                  <div className="text-[9px] font-semibold tracking-[1.5px] uppercase text-white/40 mb-1.5">
                    {m.label}
                  </div>
                  <div className={`text-[20px] font-extrabold text-white tabular-nums`}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom gold accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#BC9C45]/40 to-transparent" />
      </div>

      {/* ── Deal Card Grid ── */}
      <div className="px-10 py-10">
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center mb-5 shadow-[0_4px_20px_rgba(14,52,112,0.2)]">
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
            <p className="font-[family-name:var(--font-bodoni)] text-xl font-semibold text-[#0E3470] mb-1.5">
              No active opportunities at this time
            </p>
            <p className="text-sm text-[#6B7280]">
              Check back soon for new investment opportunities.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-7">
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} locale={locale} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* ── Confidentiality Footer ── */}
      <div className="px-10 pb-10">
        <div className="border-t border-[#EEF0F4] pt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded flex items-center justify-center">
              <span className="text-white text-[8px] font-bold font-[family-name:var(--font-bodoni)] italic">R</span>
            </div>
            <span className="text-[10px] text-[#9CA3AF] tracking-wide">
              REPRIME TERMINAL
            </span>
          </div>
          <p className="text-[10px] text-[#9CA3AF] max-w-[600px] text-right leading-relaxed">
            This material is confidential and intended solely for the use of authorized Terminal members.
            Any reproduction or distribution is strictly prohibited. All investments involve risk.
          </p>
        </div>
      </div>
    </div>
  );
}
