'use client';

import DealCard from '@/components/portal/DealCard';
import ComingSoonCard from '@/components/portal/ComingSoonCard';
import MarketIntelSidebar from '@/components/portal/MarketIntelSidebar';
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
  // Pre-pipeline fields
  psa_draft_start?: string | null;
  loi_signed_at?: string | null;
  teaser_description?: string | null;
  is_subscribed?: boolean;
  commitment_count?: number;
}

interface PortalDashboardClientProps {
  deals: DealCardData[];
  locale: string;
}

export default function PortalDashboardClient({ deals, locale }: PortalDashboardClientProps) {
  const upcomingDeals = deals.filter((d) => d.status === 'coming_soon' || d.status === 'loi_signed');
  const activeDeals = deals.filter((d) => d.status === 'published');
  const closedDeals = deals.filter((d) => d.status === 'assigned' || d.status === 'closed');
  const activeCount = activeDeals.length;
  const closedCount = closedDeals.length;

  const totalDealVolume = activeDeals.reduce((sum, d) => sum + (d.purchase_price || 0), 0);
  const totalEquity = activeDeals.reduce((sum, d) => sum + (d.equity_required || 0), 0);
  const avgIrr = activeDeals.length > 0
    ? activeDeals.reduce((sum, d) => sum + (d.irr || 0), 0) / activeDeals.length
    : 0;
  const avgCapRate = activeDeals.length > 0
    ? activeDeals.reduce((sum, d) => sum + (d.cap_rate || 0), 0) / activeDeals.length
    : 0;

  const quarterLabel =
    deals.find((d) => d.quarter_release)?.quarter_release ?? '';

  const summaryMetrics = [
    { label: 'TOTAL DEAL VOLUME', value: formatPriceCompact(totalDealVolume) },
    { label: 'AGGREGATE EQUITY', value: formatPriceCompact(totalEquity) },
    { label: 'AVG. PROJECTED IRR', value: avgIrr > 0 ? `${avgIrr.toFixed(1)}%` : '--' },
    { label: 'AVG. CAP RATE', value: avgCapRate > 0 ? `${avgCapRate.toFixed(1)}%` : '--' },
    { label: 'ACTIVE RELEASES', value: String(activeCount) },
  ];

  const hasAnyDeals = deals.length > 0;

  return (
    <div>
      {/* ── Full-width dark hero that bleeds edge to edge ── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #07090F 0%, #0A1628 35%, #0E3470 70%, #1A4A8A 100%)' }}>
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(188,156,69,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(188,156,69,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="max-w-[1600px] mx-auto relative px-10 py-12">
          <div className="flex items-end justify-between mb-8">
            <div>
              {quarterLabel && (
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0B8A4D] live-dot" />
                  <span className="text-[10px] font-medium tracking-[3px] uppercase text-[#D4A843]">
                    {quarterLabel} Release
                  </span>
                </div>
              )}
              <h1 className="font-[family-name:var(--font-playfair)] text-[42px] font-semibold text-white leading-[1.1] tracking-[-0.02em]">
                Active Opportunities
              </h1>
              <p className="text-[13px] text-white/35 mt-3 font-light tracking-wide leading-relaxed">
                {upcomingDeals.length > 0 && <>{upcomingDeals.length} upcoming &middot; </>}
                {activeCount} active &middot; {closedCount} closed &middot; All under executed PSA &middot; 30-day DD &middot; 30-day close
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white/[0.03] border border-white/[0.06] text-white/40 px-5 py-2.5 rounded-lg text-[9px] font-medium tracking-[2px] uppercase">
                CONFIDENTIAL
              </span>
            </div>
          </div>

          {activeCount > 0 && (
            <div className="grid grid-cols-5 gap-[1px] rounded-xl overflow-hidden border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {summaryMetrics.map((m) => (
                <div key={m.label} className="px-5 py-5" style={{ background: 'rgba(14, 52, 112, 0.25)', backdropFilter: 'blur(8px)' }}>
                  <div className="text-[9px] font-semibold tracking-[2px] uppercase text-white/30 mb-2">
                    {m.label}
                  </div>
                  <div className="text-[22px] font-semibold text-white tabular-nums tracking-tight">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gradient fade from hero into page background */}
        <div className="h-24" style={{ background: 'linear-gradient(180deg, transparent 0%, #F8F6F1 100%)' }} />
      </div>

      {/* ── Main Content ── */}
      <div className="px-10 py-10">
        {!hasAnyDeals ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center mb-5 shadow-[0_4px_20px_rgba(14,52,112,0.2)]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M3 21V7L12 3L21 7V21H15V13H9V21H3Z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinejoin="round" />
                <rect x="10" y="15" width="4" height="6" rx="0.5" fill="rgba(255,255,255,0.3)" />
                <rect x="7" y="9" width="2.5" height="2.5" rx="0.5" fill="rgba(255,255,255,0.3)" />
                <rect x="14.5" y="9" width="2.5" height="2.5" rx="0.5" fill="rgba(255,255,255,0.3)" />
              </svg>
            </div>
            <p className="font-[family-name:var(--font-playfair)] text-xl font-semibold text-[#0E3470] mb-1.5">
              No active opportunities at this time
            </p>
            <p className="text-sm text-[#6B7280] max-w-md text-center">
              New deals are released to qualified members on a controlled schedule.
            </p>
          </div>
        ) : (
          <div className="flex gap-8">
            <div className="flex-1 min-w-0 space-y-10">
              {/* ── Upcoming Opportunities Section ── */}
              {upcomingDeals.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      Upcoming Opportunities
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#BC9C45]/30 to-transparent" />
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6">
                    {upcomingDeals.map((deal, index) => (
                      <ComingSoonCard key={deal.id} deal={deal} index={index} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Active Deals Section ── */}
              {activeDeals.length > 0 && (
                <div>
                  {upcomingDeals.length > 0 && (
                    <div className="flex items-center gap-3 mb-5">
                      <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                        Active Deals
                      </h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#BC9C45]/30 to-transparent" />
                    </div>
                  )}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-7">
                    {activeDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Closed Deals Section ── */}
              {closedDeals.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] tracking-[-0.01em]">
                      Closed Deals
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#9CA3AF]/30 to-transparent" />
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-7">
                    {closedDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} locale={locale} index={index} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Market Intelligence Sidebar */}
            <div className="w-[320px] shrink-0">
              <MarketIntelSidebar />
            </div>
          </div>
        )}
      </div>

      {/* ── Confidentiality Footer ── */}
      <div className="px-10 pb-10">
        <div className="border-t border-[#EEF0F4] pt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded flex items-center justify-center">
              <span className="text-white text-[8px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
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
