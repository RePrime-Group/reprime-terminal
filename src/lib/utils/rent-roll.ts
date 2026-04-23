import type { TerminalTenantLease } from '@/lib/types/database';

// ─────────────────────────────────────────────────────────────────────────────
// Standalone rent-roll computations. These values are informational only and
// must NOT be fed into deal-calculator.ts (cap rate / CoC / IRR / DSCR / equity).
// ─────────────────────────────────────────────────────────────────────────────

function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = value.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Parses "12/2031", "2031-12-15", "December 2031", "Dec 2031" etc. into a Date.
// Returns null if unparseable.
export function parseLooseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // MM/YYYY
  const mmYYYY = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmYYYY) {
    const m = parseInt(mmYYYY[1], 10);
    const y = parseInt(mmYYYY[2], 10);
    return new Date(y, Math.max(0, m - 1), 1);
  }

  // YYYY-only
  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    return new Date(parseInt(yearOnly[1], 10), 11, 31);
  }

  const d = new Date(trimmed);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function yearsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

// WALT — weighted by annual base rent. Only active, non-vacant leases count.
// Formula: Σ(remaining_years_i × annual_rent_i) / Σ(annual_rent_i)
export function computeWALT(leases: TerminalTenantLease[], asOf: Date = new Date()): number | null {
  const active = leases.filter((l) => !l.is_vacant && l.status === 'Active');
  let weightedYears = 0;
  let totalRent = 0;

  for (const lease of active) {
    const end = parseLooseDate(lease.lease_end_date);
    const rent = toNum(lease.annual_base_rent);
    if (!end || rent <= 0) continue;
    const remaining = Math.max(0, yearsBetween(asOf, end));
    weightedYears += remaining * rent;
    totalRent += rent;
  }

  if (totalRent <= 0) return null;
  return weightedYears / totalRent;
}

export interface OccupancyResult {
  leasedSf: number;
  totalSf: number;
  occupancyPct: number | null;
}

export function computeOccupancy(
  leases: TerminalTenantLease[],
  dealTotalSf?: number | null,
): OccupancyResult {
  let leasedSf = 0;
  let vacantSf = 0;
  for (const lease of leases) {
    const sf = lease.leased_sf ?? 0;
    if (lease.is_vacant) vacantSf += sf;
    else leasedSf += sf;
  }

  const sumSf = leasedSf + vacantSf;
  const denominator = dealTotalSf && dealTotalSf > 0 ? dealTotalSf : sumSf;
  const occupancyPct = denominator > 0 ? (leasedSf / denominator) * 100 : null;

  return {
    leasedSf,
    totalSf: denominator,
    occupancyPct,
  };
}

export function computeTotalRent(leases: TerminalTenantLease[]): number {
  return leases.reduce((sum, l) => (l.is_vacant ? sum : sum + toNum(l.annual_base_rent)), 0);
}

export function computeAvgRentPerSf(leases: TerminalTenantLease[]): number | null {
  const totalRent = computeTotalRent(leases);
  const leasedSf = leases.reduce((sum, l) => (l.is_vacant ? sum : sum + (l.leased_sf ?? 0)), 0);
  if (leasedSf <= 0) return null;
  return totalRent / leasedSf;
}

export interface TopTenantResult {
  tenant: TerminalTenantLease;
  rent: number;
  pctOfRent: number;
}

export function computeTopTenant(leases: TerminalTenantLease[]): TopTenantResult | null {
  const active = leases.filter((l) => !l.is_vacant);
  if (active.length === 0) return null;
  const totalRent = computeTotalRent(leases);
  if (totalRent <= 0) return null;

  let top = active[0];
  let topRent = toNum(top.annual_base_rent);
  for (let i = 1; i < active.length; i++) {
    const r = toNum(active[i].annual_base_rent);
    if (r > topRent) {
      topRent = r;
      top = active[i];
    }
  }

  return {
    tenant: top,
    rent: topRent,
    pctOfRent: (topRent / totalRent) * 100,
  };
}

export interface RolloverEntry {
  tenant: TerminalTenantLease;
  rent: number;
  pctOfRent: number;
  expiration: Date;
}

// Leases expiring within `withinYears` years from asOf.
export function computeNearTermRollover(
  leases: TerminalTenantLease[],
  asOf: Date = new Date(),
  withinYears = 3,
): RolloverEntry[] {
  const totalRent = computeTotalRent(leases);
  if (totalRent <= 0) return [];

  const entries: RolloverEntry[] = [];
  for (const lease of leases) {
    if (lease.is_vacant) continue;
    const end = parseLooseDate(lease.lease_end_date);
    if (!end) continue;
    const years = yearsBetween(asOf, end);
    if (years < 0) continue; // already expired — caller can decide to include
    if (years <= withinYears) {
      const rent = toNum(lease.annual_base_rent);
      entries.push({
        tenant: lease,
        rent,
        pctOfRent: (rent / totalRent) * 100,
        expiration: end,
      });
    }
  }

  entries.sort((a, b) => a.expiration.getTime() - b.expiration.getTime());
  return entries;
}

export interface ExpirationScheduleEntry {
  year: number;
  leases: {
    tenant: TerminalTenantLease;
    rent: number;
    pctOfRent: number;
  }[];
  totalRent: number;
  pctOfRent: number;
}

// Produces year-by-year bucket for a visual expiration schedule.
export function computeExpirationSchedule(
  leases: TerminalTenantLease[],
  asOf: Date = new Date(),
  rangeYears = 10,
): ExpirationScheduleEntry[] {
  const totalRent = computeTotalRent(leases);
  const startYear = asOf.getFullYear();
  const schedule: ExpirationScheduleEntry[] = [];

  for (let i = 0; i <= rangeYears; i++) {
    schedule.push({
      year: startYear + i,
      leases: [],
      totalRent: 0,
      pctOfRent: 0,
    });
  }

  for (const lease of leases) {
    if (lease.is_vacant) continue;
    const end = parseLooseDate(lease.lease_end_date);
    if (!end) continue;
    const y = end.getFullYear();
    const bucketIdx = y - startYear;
    if (bucketIdx < 0 || bucketIdx >= schedule.length) continue;
    const rent = toNum(lease.annual_base_rent);
    schedule[bucketIdx].leases.push({
      tenant: lease,
      rent,
      pctOfRent: totalRent > 0 ? (rent / totalRent) * 100 : 0,
    });
    schedule[bucketIdx].totalRent += rent;
  }

  for (const bucket of schedule) {
    bucket.pctOfRent = totalRent > 0 ? (bucket.totalRent / totalRent) * 100 : 0;
  }

  return schedule;
}

// Default sort: anchors first, then by annual rent desc.
export function sortTenantsForDisplay(leases: TerminalTenantLease[]): TerminalTenantLease[] {
  return [...leases].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    if (a.is_anchor !== b.is_anchor) return a.is_anchor ? -1 : 1;
    return toNum(b.annual_base_rent) - toNum(a.annual_base_rent);
  });
}

export function formatYears(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)} yrs`;
}

export function formatLeaseDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = parseLooseDate(value);
  if (!d) return value;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function formatMoney(value: string | number | null | undefined): string {
  const n = toNum(value);
  if (n === 0 && (value === null || value === undefined || value === '')) return '—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatRentPerSf(value: string | number | null | undefined): string {
  const n = toNum(value);
  if (n === 0 && (value === null || value === undefined || value === '')) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function creditRatingColor(rating: string | null | undefined): string {
  if (!rating) return '#9CA3AF';
  switch (rating) {
    case 'Investment Grade':
    case 'National Credit':
      return '#0B8A4D';
    case 'Regional':
      return '#BC9C45';
    case 'Local':
    case 'Unknown':
    default:
      return '#9CA3AF';
  }
}
