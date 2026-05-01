'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RePrimeLogo from '../RePrimeLogo';

// Official launch: 90 days from April 19, 2026 = July 18, 2026 (00:00 UTC).
const LAUNCH_DATE_ISO = '2026-07-18T00:00:00Z';

interface LaunchCountdownSplashProps {
  locale: string;
}

export default function LaunchCountdownSplash({ locale }: LaunchCountdownSplashProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(LAUNCH_DATE_ISO).getTime();
  const diff = now === null ? 0 : Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  const cells = [
    { value: days, label: 'Days' },
    { value: hours, label: 'Hours' },
    { value: minutes, label: 'Minutes' },
    { value: seconds, label: 'Seconds' },
  ];

  const year = new Date().getFullYear();

  return (
    <div className="relative min-h-dvh overflow-hidden" style={{ background: '#07090F' }}>
      {/* Background image + navy gradient */}
      <img
        src="/images/login-hero.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover z-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(135deg, rgba(10,22,40,0.94) 0%, rgba(14,52,112,0.88) 50%, rgba(10,22,40,0.96) 100%)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 z-[2] opacity-[0.12]"
        style={{ background: 'radial-gradient(ellipse at center, rgba(188,156,69,0.8) 0%, transparent 65%)' }}
        aria-hidden
      />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 z-[2] opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
        aria-hidden
      />

      {/* Top + bottom gold accent rules */}
      <div className="absolute top-0 left-0 right-0 z-[3] h-[1px] bg-gradient-to-r from-transparent via-[#D4B96A] to-transparent" aria-hidden />
      <div className="absolute bottom-0 left-0 right-0 z-[3] h-[1px] bg-gradient-to-r from-transparent via-[#BC9C45]/40 to-transparent" aria-hidden />

      {/* Content */}
      <div className="relative z-10 min-h-dvh flex flex-col items-center justify-between py-8 sm:py-12 md:py-16 px-6 sm:px-10 text-center">
        {/* Logo lockup */}
        <div className="flex flex-col items-center sm:gap-4">
          
            <RePrimeLogo width={300} className="transition-opacity duration-300 group-hover:opacity-90" />
            <span className="px-1.5 py-[3px] rounded bg-[#BC9C45] text-[#07090F] text-[15px] font-bold uppercase tracking-[1.8px] leading-none">
              Beta
            </span>
         
        </div>

        {/* Headline + countdown + CTA */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 sm:gap-10 md:gap-12 w-full">
          <h1 className="font-[family-name:var(--font-playfair)] text-[#D4A843] text-[32px] sm:text-[44px] md:text-[58px] lg:text-[68px] font-semibold uppercase leading-[1.05] tracking-[0.01em]">
            The Official Launch
            <br />
            Is Imminent.
          </h1>

          <div className="flex items-end justify-center gap-3 sm:gap-5 md:gap-7">
            {cells.map((c, i) => (
              <div key={c.label} className="flex items-end">
                {i > 0 && (
                  <span className="font-[family-name:var(--font-playfair)] text-white/30 text-[44px] sm:text-[60px] md:text-[78px] leading-none mx-2 sm:mx-3 md:mx-4 -translate-y-[6px] sm:-translate-y-[10px]">
                    :
                  </span>
                )}
                <div className="flex flex-col items-center">
                  <span className="font-[family-name:var(--font-playfair)] text-white text-[48px] sm:text-[70px] md:text-[90px] lg:text-[100px] leading-[0.95] tabular-nums">
                    {now === null ? '--' : String(c.value).padStart(2, '0')}
                  </span>
                  <span className="mt-1 sm:mt-2 text-[10px] sm:text-[11px] md:text-[12px] font-semibold uppercase tracking-[3px] sm:tracking-[4px] text-[#D4A843]">
                    {c.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="font-[family-name:var(--font-playfair)] italic text-white/65 text-[13px] sm:text-[15px] md:text-[16px] leading-relaxed max-w-[620px]">
            Experience the Future of Commercial Real Estate Investment.
            <br />
            Exclusive Access.
          </p>

          {/* CTA — luxury gold button */}
          <Link
            href={`/${locale}/login`}
            className="group relative inline-flex items-center gap-3 pl-7 pr-6 py-3.5 sm:py-4 rounded-full overflow-hidden transition-all duration-300 shadow-[0_10px_30px_rgba(188,156,69,0.28)] hover:shadow-[0_16px_40px_rgba(188,156,69,0.4)] hover:-translate-y-[1px]"
            style={{
              background: 'linear-gradient(135deg, #D4B96A 0%, #BC9C45 50%, #A88A3D 100%)',
            }}
          >
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(135deg, #E0C784 0%, #D4B96A 50%, #BC9C45 100%)',
              }}
              aria-hidden
            />
            <span className="relative text-[#07090F] text-[12px] sm:text-[13px] font-bold uppercase tracking-[2.5px]">
              Enter Terminal Beta
            </span>
            <svg
              className="relative text-[#07090F] transition-transform duration-300 group-hover:translate-x-1"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        {/* Footer: gold rule + copyright */}
        <div className="w-full flex flex-col items-center max-w-[900px]">
          <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#BC9C45]/30 to-transparent mb-4" aria-hidden />
          <div className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[2.5px] text-white/40">
            &copy; {year} REPRIME. All Rights Reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
