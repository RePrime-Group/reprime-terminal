'use client';

const tickerItems = [
  { label: '10-Yr Treasury', value: '4.28%', change: '+0.03', direction: 'up' as const },
  { label: 'SOFR', value: '4.31%', change: '—', direction: 'flat' as const },
  { label: 'CRE Cap Rate Spread', value: '285 bps', change: '-12', direction: 'down' as const },
  { label: 'CMBS Delinquency', value: '11.8%', change: '+0.4', direction: 'up' as const },
  { label: 'Office Vacancy', value: '19.6%', change: '+0.2', direction: 'up' as const },
  { label: 'Multifamily Vacancy', value: '5.8%', change: '-0.1', direction: 'down' as const },
  { label: 'Industrial Vacancy', value: '4.2%', change: '-0.3', direction: 'down' as const },
  { label: 'Retail Vacancy', value: '4.1%', change: '—', direction: 'flat' as const },
];

function TickerItem({ label, value, change, direction }: (typeof tickerItems)[0]) {
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
      <span className="text-[11px] font-bold text-white">{value}</span>
      <span className={`text-[10px] font-medium ${arrowColor}`}>
        {arrow} {change}
      </span>
    </span>
  );
}

export default function MarketTicker() {
  return (
    <div className="w-full h-8 bg-[#0E3470] overflow-hidden relative">
      <div className="absolute inset-0 flex items-center">
        <div className="animate-marquee flex items-center" style={{ width: 'max-content' }}>
          {/* Duplicate the items for seamless loop */}
          {[...tickerItems, ...tickerItems].map((item, idx) => (
            <span key={idx} className="mx-5">
              <TickerItem {...item} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
