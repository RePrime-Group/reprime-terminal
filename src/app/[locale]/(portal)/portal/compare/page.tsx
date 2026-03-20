import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatPrice, formatPercent, formatDSCR } from '@/lib/utils/format';

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
}

interface MetricRow {
  label: string;
  key: string;
  format: (deal: Deal) => string;
  highlight?: boolean;
}

const metricRows: MetricRow[] = [
  {
    label: 'Purchase',
    key: 'purchase_price',
    format: (d) => formatPrice(d.purchase_price),
  },
  {
    label: 'NOI',
    key: 'noi',
    format: (d) => formatPrice(d.noi),
  },
  {
    label: 'Cap Rate',
    key: 'cap_rate',
    format: (d) => formatPercent(d.cap_rate),
  },
  {
    label: 'IRR',
    key: 'irr',
    format: (d) => formatPercent(d.irr),
    highlight: true,
  },
  {
    label: 'CoC',
    key: 'coc',
    format: (d) => formatPercent(d.coc),
    highlight: true,
  },
  {
    label: 'DSCR',
    key: 'dscr',
    format: (d) => formatDSCR(d.dscr),
  },
  {
    label: 'Equity',
    key: 'equity_required',
    format: (d) => formatPrice(d.equity_required),
  },
  {
    label: 'Score',
    key: 'score',
    format: () => '85/100',
  },
];

export default async function ComparePage({
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
    .in('status', ['published', 'assigned'])
    .order('name', { ascending: true });

  const dealList: Deal[] = deals ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="font-[family-name:var(--font-playfair)] text-[24px] font-bold text-[#0A1628]">
        Deal Comparison
      </h1>

      {dealList.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-6 py-12 text-center">
          <p className="text-[14px] text-gray-400">
            No deals available for comparison.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-200">
                {/* Empty first cell for metric labels */}
                <th className="text-left px-5 py-4 text-[11px] uppercase tracking-[0.06em] text-gray-400 font-medium w-[140px]">
                  Metric
                </th>
                {dealList.map((deal) => (
                  <th
                    key={deal.id}
                    className="text-left px-5 py-4 min-w-[160px]"
                  >
                    <p className="text-[14px] font-semibold text-[#0A1628]">
                      {deal.name}
                    </p>
                    <p className="text-[11px] text-gray-500 font-normal">
                      {deal.city}, {deal.state}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRows.map((row, idx) => (
                <tr
                  key={row.key}
                  className={idx % 2 === 1 ? 'bg-[#F7F8FA]' : 'bg-white'}
                >
                  <td className="px-5 py-3 text-[11px] uppercase tracking-[0.06em] text-gray-400 font-medium">
                    {row.label}
                  </td>
                  {dealList.map((deal) => (
                    <td
                      key={deal.id}
                      className={`px-5 py-3 font-semibold ${
                        row.highlight ? 'text-[#0B8A4D]' : 'text-[#0A1628]'
                      }`}
                    >
                      {row.format(deal)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
