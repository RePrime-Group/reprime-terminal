import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { fetchFredSeriesWithChange, FALLBACK_MARKET_DATA, type MarketDataPoint } from '@/lib/market-data';

export async function GET() {
  const results: MarketDataPoint[] = [];

  // Fetch Treasury and SOFR from FRED
  const [treasury, sofr] = await Promise.all([
    fetchFredSeriesWithChange('DGS10'),
    fetchFredSeriesWithChange('SOFR'),
  ]);

  if (treasury) {
    results.push({
      label: '10-Yr Treasury',
      value: `${treasury.value.toFixed(2)}%`,
      change: treasury.change >= 0 ? `+${treasury.change.toFixed(2)}` : treasury.change.toFixed(2),
      direction: treasury.change > 0 ? 'up' : treasury.change < 0 ? 'down' : 'flat',
    });
  }

  if (sofr) {
    results.push({
      label: 'SOFR',
      value: `${sofr.value.toFixed(2)}%`,
      change: sofr.change >= 0 ? `+${sofr.change.toFixed(2)}` : sofr.change.toFixed(2),
      direction: sofr.change > 0 ? 'up' : sofr.change < 0 ? 'down' : 'flat',
    });
  }

  // Fetch CRE data from terminal_market_data table
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: creData } = await supabase
      .from('terminal_market_data')
      .select('*')
      .order('display_order', { ascending: true });

    if (creData && creData.length > 0) {
      for (const item of creData) {
        results.push({
          label: item.label,
          value: item.value,
          change: item.change || '—',
          direction: (item.direction as 'up' | 'down' | 'flat') || 'flat',
        });
      }
    }
  } catch {
    // If DB fetch fails, that's okay — we'll use fallback
  }

  // If we got no results at all, use fallback
  if (results.length === 0) {
    return NextResponse.json({
      data: FALLBACK_MARKET_DATA,
      source: 'fallback',
      asOf: new Date().toISOString(),
    });
  }

  // If we only got FRED data but no CRE, pad with fallback CRE data
  if (results.length <= 2) {
    const creeFallbacks = FALLBACK_MARKET_DATA.filter(
      (d) => d.label !== '10-Yr Treasury' && d.label !== 'SOFR'
    );
    results.push(...creeFallbacks);
  }

  return NextResponse.json({
    data: results,
    source: treasury || sofr ? 'fred+db' : 'db',
    asOf: new Date().toISOString(),
  });
}
