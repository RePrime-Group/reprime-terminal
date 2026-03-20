'use client';

import React from 'react';

const maturityData = [
  { year: '2026', amount: '$520B', width: '75%' },
  { year: '2027', amount: '$480B', width: '68%' },
  { year: '2028', amount: '$390B', width: '55%' },
  { year: '2029', amount: '$310B', width: '44%' },
];

const activityFeed = [
  { color: 'bg-blue-500', text: 'New deal published: Port Industrial Center', time: '2 min ago' },
  { color: 'bg-[#BC9C45]', text: 'Meeting confirmed with investor', time: '15 min ago' },
  { color: 'bg-[#0B8A4D]', text: 'DD document verified', time: '1 hr ago' },
  { color: 'bg-blue-500', text: 'Market report updated', time: '3 hr ago' },
  { color: 'bg-gray-400', text: 'Terminal member viewed deal', time: '5 hr ago' },
];

export default function MarketIntelSidebar() {
  return (
    <aside className="w-[320px] flex flex-col gap-4">
      {/* Card 1: Market Cycle */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <h3
          className="uppercase font-[700] tracking-[1px] mb-4"
          style={{ fontSize: '11px', color: '#0E3470', letterSpacing: '1px' }}
        >
          MARKET CYCLE
        </h3>

        <div className="relative mt-2 mb-3">
          <div
            className="h-2 rounded-full w-full"
            style={{
              background:
                'linear-gradient(90deg, #0B8A4D 0%, #BC9C45 40%, #D97706 60%, #DC2626 100%)',
              opacity: 0.6,
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: '32%' }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white"
              style={{
                backgroundColor: '#BC9C45',
                boxShadow: '0 0 8px rgba(188,156,69,0.4)',
              }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center mt-1">
          <span
            className="uppercase font-[600]"
            style={{ fontSize: '9px', color: '#0B8A4D', letterSpacing: '1px' }}
          >
            RECOVERY
          </span>
          <span
            className="uppercase font-[600]"
            style={{ fontSize: '9px', color: '#BC9C45', letterSpacing: '1px' }}
          >
            &larr; HERE
          </span>
          <span
            className="uppercase font-[600]"
            style={{ fontSize: '9px', color: '#DC2626', letterSpacing: '1px' }}
          >
            PEAK
          </span>
        </div>
      </div>

      {/* Card 2: CRE Maturity Wall */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <h3
          className="uppercase font-[700] tracking-[1px] mb-4"
          style={{ fontSize: '11px', color: '#0E3470', letterSpacing: '1px' }}
        >
          CRE MATURITY WALL
        </h3>

        <div className="flex flex-col gap-3">
          {maturityData.map((row) => (
            <div key={row.year}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="font-[600]"
                  style={{ fontSize: '11px', color: '#0E3470' }}
                >
                  {row.year}
                </span>
                <span
                  className="font-[700]"
                  style={{ fontSize: '11px', color: '#BC9C45' }}
                >
                  {row.amount}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-[6px]">
                <div
                  className="h-[6px] rounded-full"
                  style={{
                    width: row.width,
                    background: 'linear-gradient(90deg, #0E3470, #BC9C45)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card 3: Terminal Activity Feed */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="live-dot animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0B8A4D] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0B8A4D]" />
          </span>
          <h3
            className="uppercase font-[700] tracking-[1px]"
            style={{ fontSize: '11px', color: '#0E3470', letterSpacing: '1px' }}
          >
            TERMINAL ACTIVITY
          </h3>
        </div>

        <div className="flex flex-col gap-3">
          {activityFeed.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 animate-slide-in"
              style={{ animationDelay: `${idx * 0.06}s` }}
            >
              <span
                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.color}`}
              />
              <div className="min-w-0">
                <p
                  className="font-[500] leading-tight"
                  style={{ fontSize: '11px', color: '#0E3470' }}
                >
                  {item.text}
                </p>
                <p
                  className="mt-0.5"
                  style={{ fontSize: '10px', color: '#94A3B8' }}
                >
                  {item.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
