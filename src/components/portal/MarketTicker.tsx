'use client';

import { useState, useEffect } from 'react';
import type { MarketDataPoint } from '@/lib/market-data';
import { FALLBACK_MARKET_DATA } from '@/lib/market-data';

function formatAsOf(asOf: string): string {
  const d = new Date(asOf);
  return isNaN(d.getTime()) ? asOf : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

type TipHandlers = {
  onTip: (e: React.MouseEvent<HTMLElement>, text: string) => void;
  onHide: () => void;
};

function TickerItem({ label, value, change, direction, source, asOf, onTip, onHide }: MarketDataPoint & TipHandlers) {
  const hasChange = !!change && change !== '—';
  const changeStyle: React.CSSProperties =
    direction === 'up'
      ? { background: 'rgba(220,38,38,0.2)', color: '#FCA5A5' }
      : direction === 'down'
        ? { background: 'rgba(11,138,77,0.25)', color: '#86EFAC' }
        : { background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' };
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';
  const tooltip = source
    ? `Source: ${source}${asOf ? `, as of ${formatAsOf(asOf)}` : ''}`
    : 'Indicative figure, source not specified';

  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap cursor-help rounded px-1.5 -mx-1.5 hover:bg-white/[0.06] transition-colors"
      onMouseEnter={(e) => onTip(e, tooltip)}
      onMouseLeave={onHide}
    >
      <span className="text-[13px] font-semibold uppercase tracking-[1.2px] text-white">
        {label}
      </span>
      <span className="text-[13px] font-bold text-white tabular-nums leading-none">{value}</span>
      {hasChange && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
          style={changeStyle}
        >
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
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

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

  // Custom tooltip: a native title can't fire on a moving marquee, and the bar
  // is overflow-hidden, so we position a fixed tooltip from the hovered rect.
  const showTip = (e: React.MouseEvent<HTMLElement>, text: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ text, x: r.left + r.width / 2, y: r.bottom });
  };
  const hideTip = () => setTip(null);

  const doubled = [...items, ...items];

  return (
    <>
      <div
        className="w-full h-9 overflow-hidden relative"
        style={{
          background: 'linear-gradient(to right, #0A1628 0%, #0E3470 50%, #0A1628 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="absolute inset-0 flex items-center">
          <div className="animate-marquee flex items-center hover:[animation-play-state:paused]" style={{ width: 'max-content' }}>
            {doubled.map((item, idx) => (
              <span key={idx} className="inline-flex items-center">
                <span className="px-6">
                  <TickerItem {...item} onTip={showTip} onHide={hideTip} />
                </span>
                <span
                  className="h-3 w-px"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                  aria-hidden
                />
              </span>
            ))}
            {asOf && (
              <span
                className="px-6 text-[10px] font-medium uppercase tracking-[1.2px] cursor-help"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                onMouseEnter={(e) =>
                  showTip(
                    e,
                    'Rates sourced from FRED (Federal Reserve). CRE indicators are indicative unless a source is shown. Refreshes hourly.',
                  )
                }
                onMouseLeave={hideTip}
              >
                Rates via FRED · refreshes hourly · as of {new Date(asOf).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {tip && (
        <div
          role="tooltip"
          className="fixed z-[300] pointer-events-none -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-[14px] font-medium leading-snug text-[#0A1628] shadow-xl"
          style={{ left: tip.x, top: tip.y + 8, maxWidth: 360 }}
        >
          <span
            className="absolute left-1/2 -top-1 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white"
            aria-hidden
          />
          {tip.text}
        </div>
      )}
    </>
  );
}
