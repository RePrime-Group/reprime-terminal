export interface MarketDataPoint {
  label: string;
  value: string;
  change: string;
  direction: 'up' | 'down' | 'flat';
}

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

export async function fetchFredSeries(seriesId: string): Promise<{ value: number; date: string } | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // 1 hour cache
    if (!res.ok) return null;

    const data = await res.json();
    const observations = data.observations;
    if (!observations || observations.length === 0) return null;

    const latest = observations[0];
    return {
      value: parseFloat(latest.value),
      date: latest.date,
    };
  } catch {
    return null;
  }
}

export async function fetchFredSeriesWithChange(seriesId: string): Promise<{
  value: number;
  change: number;
  date: string;
} | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    const obs = data.observations;
    if (!obs || obs.length < 1) return null;

    const latest = parseFloat(obs[0].value);
    const previous = obs.length > 1 ? parseFloat(obs[1].value) : latest;
    const change = latest - previous;

    return { value: latest, change, date: obs[0].date };
  } catch {
    return null;
  }
}

// Hardcoded fallback data in case FRED or DB is unavailable
export const FALLBACK_MARKET_DATA: MarketDataPoint[] = [
  { label: '10-Yr Treasury', value: '4.28%', change: '+0.03', direction: 'up' },
  { label: 'SOFR', value: '4.31%', change: '—', direction: 'flat' },
  { label: 'CRE Cap Rate Spread', value: '285 bps', change: '-12', direction: 'down' },
  { label: 'CMBS Delinquency', value: '11.8%', change: '+0.4', direction: 'up' },
  { label: 'Office Vacancy', value: '19.6%', change: '+0.2', direction: 'up' },
  { label: 'Multifamily Vacancy', value: '5.8%', change: '-0.1', direction: 'down' },
  { label: 'Industrial Vacancy', value: '4.2%', change: '-0.3', direction: 'down' },
  { label: 'Retail Vacancy', value: '4.1%', change: '—', direction: 'flat' },
];
