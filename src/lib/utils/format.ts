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
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}K`;
  }
  return currencyFull.format(n);
}

/** "10.0%" — percentage with one decimal */
export function formatPercent(value: string | number | null | undefined): string {
  if (value == null) return '—';
  const s = String(value).replace(/[%\s]/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return value?.toString() || '—';
  // If the raw value looks like a decimal < 1 (e.g. 0.10 for 10%), multiply
  if (n > 0 && n < 1) return `${(n * 100).toFixed(1)}%`;
  return `${n.toFixed(1)}%`;
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
