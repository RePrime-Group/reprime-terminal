const currencyFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const numberFmt = new Intl.NumberFormat('en-US');

/**
 * Parse a value that may be a string like "$10,000,000", "10000000",
 * "10M", or a number. Returns NaN if unparseable.
 */
function toNumber(value: string | number | null | undefined): number {
  if (value == null) return NaN;
  if (typeof value === 'number') return value;
  // Strip $ , and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');
  return parseFloat(cleaned);
}

/** "$10,000,000" — full dollar format */
export function formatPrice(value: string | number | null | undefined): string {
  const n = toNumber(value);
  if (isNaN(n)) return value?.toString() || '—';
  return currencyFull.format(n);
}

/** "$10.0M" — compact dollar format for cards */
export function formatPriceCompact(value: string | number | null | undefined): string {
  const n = toNumber(value);
  if (isNaN(n)) return value?.toString() || '—';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${parseFloat(m.toFixed(3))}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}K`;
  }
  return currencyFull.format(n);
}

/** "10.0%" — percentage with one decimal.
 * Values stored as whole numbers (e.g. "10", "18.5") display as-is with %.
 * Values stored as decimals < 1 (e.g. 0.10) are multiplied by 100.
 * Already-formatted strings with % are passed through. */
export function formatPercent(value: string | number | null | undefined): string {
  if (value == null) return '—';
  const raw = String(value).trim();
  // If it already ends with %, strip and re-format
  if (raw.endsWith('%')) {
    const n = parseFloat(raw.replace('%', ''));
    if (isNaN(n)) return raw;
    return `${n.toFixed(2)}%`;
  }
  const n = parseFloat(raw);
  if (isNaN(n)) return value?.toString() || '—';
  // Only multiply if it's a true decimal (between 0 and 1 exclusive)
  // Values like "10", "18.5", "125" are already percentages
  if (n > 0 && n < 1) return `${(n * 100).toFixed(2)}%`;
  return `${n.toFixed(2)}%`;
}

/** "1.25x" — DSCR format */
export function formatDSCR(value: string | number | null | undefined): string {
  if (value == null) return '—';
  const s = String(value).replace(/[x×\s]/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return value?.toString() || '—';
  return `${n.toFixed(2)}x`;
}

/** "100,000 SF" */
export function formatSqFt(value: string | number | null | undefined): string {
  const n = toNumber(value);
  if (isNaN(n)) return value?.toString() || '—';
  return `${numberFmt.format(n)} SF`;
}

/** "1,250,000" — plain number with commas */
export function formatNumber(value: string | number | null | undefined): string {
  const n = toNumber(value);
  if (isNaN(n)) return value?.toString() || '—';
  return numberFmt.format(n);
}

/** Unicode ∞ for fully-financed deals where there is no investor equity. */
export const INFINITY_SYMBOL = '∞';
export const INFINITY_GREEN = '#0B8A4D';

/**
 * Return the display string for CoC / IRR / Equity Multiple when the deal
 * has zero-or-negative investor equity. Shows ∞ if the expected return is
 * positive, "N/A" if not (can't promise infinite returns on negative cash flow).
 */
export function formatInfinityMetric(hasPositiveReturn: boolean): string {
  return hasPositiveReturn ? INFINITY_SYMBOL : 'N/A';
}
