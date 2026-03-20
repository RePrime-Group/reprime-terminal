import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatPriceCompact, formatPercent } from '@/lib/utils/format';

interface Deal {
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
  status: string;
  assigned_to: string | null;
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    assigned: { label: 'Performing', bg: 'bg-green-50', text: 'text-green-700' },
    renovation: { label: 'Under Renovation', bg: 'bg-amber-50', text: 'text-amber-700' },
    stabilized: { label: 'Stabilized', bg: 'bg-blue-50', text: 'text-blue-700' },
    closed: { label: 'Closed', bg: 'bg-[#0A1628]/5', text: 'text-[#0A1628]' },
  };
  const badge = map[status] ?? map.assigned;
  return badge;
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const { data: deals } = await supabase
    .from('terminal_deals')
    .select('*')
    .eq('assigned_to', user.id)
    .in('status', ['assigned', 'closed'])
    .order('name', { ascending: true });

  const activeDealCount = deals?.filter((d) => d.status === 'assigned').length ?? 0;

  const avgIrr =
    deals && deals.length > 0
      ? deals.reduce((sum: number, d: Deal) => sum + (d.irr ?? 0), 0) / deals.length
      : 0;

  const metrics = [
    {
      label: 'TOTAL INVESTED',
      value: '$12.4M',
      border: 'border-[#0A1628]',
    },
    {
      label: 'ACTIVE DEALS',
      value: String(activeDealCount),
      border: 'border-[#1E40AF]',
    },
    {
      label: 'AVG. IRR',
      value: formatPercent(avgIrr),
      border: 'border-[#0B8A4D]',
    },
    {
      label: 'TOTAL RETURN',
      value: '$3.8M',
      border: 'border-[#0B8A4D]',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`bg-white rounded-lg p-5 border-l-[3px] ${m.border} shadow-sm`}
          >
            <p
              className="text-[9px] uppercase tracking-[0.08em] text-gray-400 font-medium"
              data-label=""
            >
              {m.label}
            </p>
            <p className="text-[22px] font-[800] text-[#0A1628] mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Heading */}
      <h2 className="font-[family-name:var(--font-playfair)] text-[20px] font-bold text-[#0A1628]">
        Your Investments
      </h2>

      {/* Investments List */}
      {deals && deals.length > 0 ? (
        <div className="space-y-3">
          {deals.map((deal: Deal) => {
            const badge = getStatusBadge(deal.status);
            return (
              <div
                key={deal.id}
                className="bg-white rounded-lg shadow-sm border border-gray-100 px-5 py-4 flex items-center justify-between gap-4"
              >
                {/* Left: Icon + Info */}
                <div className="flex items-center gap-4 min-w-0">
                  {/* Property type icon */}
                  <div className="w-[44px] h-[44px] rounded-full bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] flex items-center justify-center flex-shrink-0">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="4" y="2" width="16" height="20" rx="1" />
                      <path d="M9 22V12h6v10" />
                      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
                    </svg>
                  </div>
                  {/* Name + location */}
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#0A1628] truncate">
                      {deal.name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {deal.city}, {deal.state} &middot; {deal.property_type}
                    </p>
                  </div>
                </div>

                {/* Right: Metrics + Badge */}
                <div className="flex items-center gap-6 flex-shrink-0">
                  {/* Invested */}
                  <div className="text-right hidden sm:block">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-gray-400 font-medium">
                      INVESTED
                    </p>
                    <p className="text-[14px] font-semibold text-[#0A1628]">
                      {formatPriceCompact(deal.purchase_price)}
                    </p>
                  </div>
                  {/* IRR */}
                  <div className="text-right hidden sm:block">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-gray-400 font-medium">
                      IRR
                    </p>
                    <p className="text-[14px] font-semibold text-[#0B8A4D]">
                      {formatPercent(deal.irr)}
                    </p>
                  </div>
                  {/* Status badge */}
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium ${badge.bg} ${badge.text}`}
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-6 py-12 text-center">
          <p className="text-[14px] text-gray-400">
            Your investments will appear here once you close your first deal.
          </p>
        </div>
      )}
    </div>
  );
}
