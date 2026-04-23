import type { CapExItem, CapExCondition, CapExPriority } from '@/lib/types/database';

// ─────────────────────────────────────────────────────────────────────────────
// Standalone CapEx computations. These values are informational only and must
// NOT be fed into deal-calculator.ts or auto-populate terminal_deals.capex.
// ─────────────────────────────────────────────────────────────────────────────

export const CAPEX_CONDITIONS: CapExCondition[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Unknown'];
export const CAPEX_PRIORITIES: CapExPriority[] = ['Immediate', 'Near-Term', 'During Hold', 'Post-Hold', 'N/A'];

function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = value.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export type PriorityTotals = Record<CapExPriority, number>;

export function groupByPriority(items: CapExItem[]): PriorityTotals {
  const totals: PriorityTotals = {
    'Immediate': 0,
    'Near-Term': 0,
    'During Hold': 0,
    'Post-Hold': 0,
    'N/A': 0,
  };
  for (const item of items) {
    const cost = toNum(item.estimated_replacement_cost);
    const key = CAPEX_PRIORITIES.includes(item.priority) ? item.priority : 'During Hold';
    totals[key] += cost;
  }
  return totals;
}

// Total of hold-relevant line items (Immediate + Near-Term + During Hold).
// Post-Hold and N/A items are excluded from the investor budget summary total.
export function computeTotalDuringHold(items: CapExItem[]): number {
  const totals = groupByPriority(items);
  return totals['Immediate'] + totals['Near-Term'] + totals['During Hold'];
}

// Annualized reserve = (Near-Term + During Hold) / hold period.
// Immediate items are one-time, not annualized; Post-Hold/N/A excluded.
// Returns 0 if no qualifying items or hold period is not positive.
export function computeAnnualizedReserve(items: CapExItem[], holdPeriodYears: number): number {
  const totals = groupByPriority(items);
  const spendable = totals['Near-Term'] + totals['During Hold'];
  if (spendable <= 0 || holdPeriodYears <= 0) return 0;
  return spendable / holdPeriodYears;
}

export function sortCapExForDisplay(items: CapExItem[]): CapExItem[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function conditionColor(condition: CapExCondition): {
  dot: string;
  text: string;
  bg: string;
} {
  switch (condition) {
    case 'Excellent':
    case 'Good':
      return { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
    case 'Fair':
      return { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' };
    case 'Poor':
      return { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' };
    case 'Unknown':
    default:
      return { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100' };
  }
}

export function formatMoney(value: string | number | null | undefined, showDash = true): string {
  const n = toNum(value);
  if (n === 0 && showDash) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function parseHoldPeriod(holdPeriodYears: string | null | undefined, fallback = 5): number {
  if (!holdPeriodYears) return fallback;
  const n = parseFloat(String(holdPeriodYears).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
