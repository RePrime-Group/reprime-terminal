'use client';

import { useState, useEffect } from 'react';
import type { MarketDataPoint } from '@/lib/market-data';
import { FALLBACK_MARKET_DATA } from '@/lib/market-data';

function TickerItem({ label, value, change, direction }: MarketDataPoint) {
  const arrowColor =
    direction === 'up'
      ? 'text-[#DC2626]'
      : direction === 'down'
        ? 'text-[#0B8A4D]'
        : 'text-[#9CA3AF]';
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {label}:
      </span>
      <span className="text-[11px] font-bold text-white tabular-nums">{value}</span>
      <span className={`text-[10px] font-medium ${arrowColor}`}>
        {arrow} {change}
      </span>
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

  return (
    <div className="w-full h-8 bg-[#0E3470] overflow-hidden relative">
      <div className="absolute inset-0 flex items-center">
        <div className="animate-marquee flex items-center" style={{ width: 'max-content' }}>
          {/* Duplicate the items for seamless loop */}
          {[...items, ...items].map((item, idx) => (
            <span key={idx} className="mx-5">
              <TickerItem {...item} />
            </span>
          ))}
          {asOf && (
            <span className="mx-5 text-[10px] text-white/20">
              as of {new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
