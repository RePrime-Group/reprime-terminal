'use client';

import { useState, useEffect } from 'react';
import type { MarketDataPoint } from '@/lib/market-data';
import { FALLBACK_MARKET_DATA } from '@/lib/market-data';

function TickerItem({ label, value, change, direction }: MarketDataPoint) {
  const hasChange = !!change && change !== '—';
  const changeStyles =
    direction === 'up'
      ? 'bg-[#DC2626]/20 text-[#FCA5A5]'
      : direction === 'down'
        ? 'bg-[#0B8A4D]/25 text-[#86EFAC]'
        : 'bg-white/10 text-white/60';
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="text-[9px] font-semibold uppercase tracking-[1.2px] text-white/60">
        {label}
      </span>
      <span className="text-[13px] font-bold text-white tabular-nums leading-none">{value}</span>
      {hasChange && (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${changeStyles}`}>
          {arrow && <span className="text-[8px]">{arrow}</span>}
          {change}
        </span>
      )}
    </span>
  );
}

export default function MarketTicker() {
  const [items, setItems] = useState<MarketDataPoint[]>(FALLBACK_MARKET_DATA);
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/market-data');
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setItems(json.data);
            setAsOf(json.asOf);
          }
        }
      } catch {
        // Keep fallback data
      }
    }

    fetchData();

    // Refresh every 5 minutes for FRED data
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const doubled = [...items, ...items];

  return (
    <div className="w-full h-9 bg-gradient-to-r from-[#0A1628] via-[#0E3470] to-[#0A1628] overflow-hidden relative border-b border-white/[0.06]">
      <div className="absolute inset-0 flex items-center">
        <div className="animate-marquee flex items-center" style={{ width: 'max-content' }}>
          {doubled.map((item, idx) => (
            <span key={idx} className="inline-flex items-center">
              <span className="px-6">
                <TickerItem {...item} />
              </span>
              <span className="h-3 w-px bg-white/15" aria-hidden />
            </span>
          ))}
          {asOf && (
            <span className="px-6 text-[10px] font-medium uppercase tracking-[1.2px] text-white/40">
              as of {new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
