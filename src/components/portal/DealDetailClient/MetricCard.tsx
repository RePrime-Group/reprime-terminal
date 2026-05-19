'use client';

import type { DealMetrics } from '@/lib/utils/deal-calculator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the IRR assumptions note shown below the IRR value on metric cards.
 * Uses the deal's stored exit cap / hold / rent growth, with a "(entry +1%)"
 * qualifier when exit cap falls back to the default.
 */
export function buildIrrAssumptions(
  deal: { exit_cap_rate?: string | null; hold_period_years?: string | null; rent_growth?: string | null },
  metrics: Pick<DealMetrics, 'capRate'>
): string {
  const storedExit = deal.exit_cap_rate ? parseFloat(String(deal.exit_cap_rate)) : 0;
  const exitCapStr = storedExit > 0
    ? `${storedExit.toFixed(1)}% exit`
    : `${(metrics.capRate + 1).toFixed(1)}% exit (entry +1%)`;
  const hold = deal.hold_period_years ? parseInt(String(deal.hold_period_years), 10) : 5;
  const holdStr = `${hold}yr hold`;
  const growth = deal.rent_growth ? parseFloat(String(deal.rent_growth)) : 0;
  const growthStr = growth > 0 ? ` · ${growth.toFixed(1)}% growth` : '';
  return `${exitCapStr} · ${holdStr}${growthStr}`;
}

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------

export function MetricCard({
  label,
  value,
  borderColor,
  valueColor,
  note,
  size = 'normal',
}: {
  label: string;
  value: string | null;
  borderColor: string;
  valueColor?: string;
  note?: string;
  size?: 'headline' | 'normal';
}) {
  const valueSize =
    size === 'headline'
      ? 'text-[26px] md:text-[34px]'
      : 'text-[20px] md:text-[27px]';
  return (
    <div
      className="group relative h-full bg-white rounded-xl p-3 md:p-3.5 border border-[#EEF0F4] rp-card-shadow hover:shadow-[0_6px_24px_rgba(14,52,112,0.08)] hover:-translate-y-[1px] transition-all duration-200"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="data-label mb-1.5">
        {label}
      </div>
      <div
        className={`${valueSize} font-bold tabular-nums leading-none tracking-tight`}
        style={{ color: valueColor ?? '#0E3470' }}
      >
        {value ?? '—'}
      </div>
      {note && (
        <div className="text-[10px] text-[#9CA3AF] mt-1.5 leading-tight">
          {note}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileTypeBadge
// ---------------------------------------------------------------------------

export function FileTypeBadge({ fileType }: { fileType: string | null }) {
  const ext = fileType?.toLowerCase() ?? '';
  let icon = '\u{1F4C4}';
  let colorClass = 'bg-gray-100 text-gray-600';
  let label = 'FILE';

  if (ext.includes('pdf')) {
    icon = '\u{1F4D5}';
    colorClass = 'bg-red-100 text-red-600';
    label = 'PDF';
  } else if (ext.includes('sheet') || ext.includes('xlsx')) {
    icon = '\u{1F4D7}';
    colorClass = 'bg-green-100 text-green-600';
    label = 'XLSX';
  } else if (ext.includes('word') || ext.includes('docx')) {
    colorClass = 'bg-blue-100 text-blue-600';
    label = 'DOC';
  } else if (ext.includes('zip')) {
    icon = '\u{1F4E6}';
    colorClass = 'bg-blue-100 text-blue-600';
    label = 'ZIP';
  }

  return (
    <span className={`${colorClass} text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1`}>
      <span>{icon}</span> {label}
    </span>
  );
}
