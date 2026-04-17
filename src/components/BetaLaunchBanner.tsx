'use client';

import { useEffect, useState } from 'react';

// Official launch: 90 days from April 19, 2026 = July 18, 2026 (00:00 UTC).
const LAUNCH_DATE_ISO = '2026-07-18T00:00:00Z';

export default function BetaLaunchBanner() {
  const [now, setNow] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-collapse on small viewports so the card never covers form controls.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setCollapsed(mq.matches);
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else mq.addListener(apply);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', apply);
      else mq.removeListener(apply);
    };
  }, []);

  const target = new Date(LAUNCH_DATE_ISO).getTime();
  const diff = now === null ? 0 : Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const isLaunched = now !== null && diff === 0;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Show launch countdown"
        className="fixed bottom-5 right-5 z-50 group"
      >
        <span className="flex items-center justify-center w-11 h-11 rounded-full bg-[#0A1628] border border-[#BC9C45]/40 shadow-[0_10px_30px_rgba(10,22,40,0.35)] hover:border-[#BC9C45] transition-colors">
          <span className="absolute inset-0 rounded-full bg-[#BC9C45]/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
          <span className="relative font-[family-name:var(--font-playfair)] italic text-[#D4A843] text-[16px] font-semibold leading-none">R</span>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#BC9C45]">
            <span className="absolute inset-0 rounded-full bg-[#BC9C45] animate-ping opacity-60" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 select-none"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Outer gold glow */}
      <div
        className="absolute -inset-[1px] rounded-[14px] opacity-60 blur-[2px]"
        style={{
          background: 'linear-gradient(135deg, rgba(188,156,69,0.55) 0%, rgba(188,156,69,0.05) 50%, rgba(188,156,69,0.45) 100%)',
        }}
        aria-hidden
      />

      <div
        className="relative rounded-[13px] bg-gradient-to-br from-[#0A1628] via-[#0B1B33] to-[#0A1628] backdrop-blur-md shadow-[0_20px_50px_rgba(7,9,15,0.55)] border border-[#BC9C45]/25 overflow-hidden"
      >
        {/* Gold top accent line */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[#D4B96A] to-transparent" aria-hidden />

        {/* Subtle inner radial highlight */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top left, #D4B96A 0%, transparent 60%)' }}
          aria-hidden
        />

        {/* Close button */}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Minimize countdown"
          className="absolute top-2.5 right-2.5 z-10 w-5 h-5 rounded-full flex items-center justify-center text-white/30 hover:text-[#D4A843] hover:bg-white/[0.04] transition-colors"
        >
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>

        <div className={`relative px-5 pt-4 pb-4 transition-all duration-300 ease-out ${expanded ? 'min-w-[310px]' : 'min-w-[210px]'}`}>
          {/* Header */}
          <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
            <span className="relative flex items-center justify-center w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-[#BC9C45] opacity-50 animate-ping" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-[#D4A843]" />
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[3px] text-white/50">
              Terminal
            </span>
            <span className="font-[family-name:var(--font-playfair)] italic text-[#D4A843] text-[12px] leading-none">
              Beta
            </span>
          </div>

          {/* Body */}
          {isLaunched ? (
            <div className="pt-3">
              <div className="font-[family-name:var(--font-playfair)] italic text-[#D4A843] text-[22px] leading-tight">
                Now live
              </div>
              <div className="text-[9px] font-medium uppercase tracking-[2.5px] text-white/40 mt-1.5">
                Official launch
              </div>
            </div>
          ) : (
            <>
              <div className="pt-3 flex items-end gap-4">
                {/* Days block - always prominent */}
                <div className="flex flex-col items-start">
                  <span className="font-[family-name:var(--font-playfair)] text-white text-[40px] leading-[0.9] tabular-nums tracking-tight">
                    {now === null ? '--' : String(days).padStart(2, '0')}
                  </span>
                  <span className="mt-1 text-[8px] font-semibold uppercase tracking-[3px] text-[#D4A843]">
                    Days
                  </span>
                </div>

                {/* Expanded: HH MM SS */}
                <div
                  className={`flex items-end gap-2.5 transition-all duration-300 ease-out overflow-hidden ${
                    expanded ? 'opacity-100 max-w-[240px] ml-0' : 'opacity-0 max-w-0 ml-[-8px]'
                  }`}
                >
                  <span className="font-[family-name:var(--font-playfair)] italic text-white/20 text-[28px] leading-[0.9] -mb-0.5">·</span>
                  {[
                    { value: hours, label: 'Hrs' },
                    { value: minutes, label: 'Min' },
                    { value: seconds, label: 'Sec' },
                  ].map((c) => (
                    <div key={c.label} className="flex flex-col items-start">
                      <span className="font-[family-name:var(--font-playfair)] text-white/85 text-[20px] leading-[0.9] tabular-nums">
                        {now === null ? '--' : String(c.value).padStart(2, '0')}
                      </span>
                      <span className="mt-1 text-[7.5px] font-semibold uppercase tracking-[2.5px] text-white/40">
                        {c.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Thin gold divider */}
              <div className="mt-3.5 h-px bg-gradient-to-r from-[#BC9C45]/40 via-[#BC9C45]/10 to-transparent" aria-hidden />

              {/* Footer caption */}
              <div className="mt-2.5">
                <span className="text-[8.5px] font-medium uppercase tracking-[2.5px] text-white/35">
                  Until official launch
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
