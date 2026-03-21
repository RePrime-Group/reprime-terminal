'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Link, usePathname } from '@/i18n/navigation';

interface PortalNavbarProps {
  firstName: string;
  locale: string;
  activeTab?: 'dashboard' | 'portfolio' | 'compare';
}

const notifications = [
  { icon: '🏢', title: 'New Deal Published', desc: 'Port Industrial Center — Little Rock, AR', time: '2 min ago' },
  { icon: '📄', title: 'DD Document Uploaded', desc: 'Phase I ESA for Riverside Gardens', time: '1 hr ago' },
  { icon: '📅', title: 'Meeting Confirmed', desc: 'Shirel Gratsiani — Tomorrow 10:00 AM', time: '3 hr ago' },
  { icon: '📊', title: 'Price Alert', desc: '10-Yr Treasury crossed 4.30% threshold', time: '5 hr ago' },
];

export default function PortalNavbar({ firstName, locale, activeTab = 'dashboard' }: PortalNavbarProps) {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = firstName ? firstName[0].toUpperCase() : 'U';

  const navTabs = [
    { key: 'dashboard', label: t('dashboardTitle'), href: '/portal' },
    { key: 'portfolio', label: 'Portfolio', href: '/portal/portfolio' },
    { key: 'compare', label: 'Compare', href: '/portal/compare' },
  ];

  return (
    <>
      {/* Gold accent strip */}
      <div className="h-[2px] bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />

      <nav className="h-[64px] bg-[#07090F]/95 backdrop-blur-xl px-8 flex items-center justify-between sticky top-0 z-50 border-b border-white/[0.06]">
        {/* Left: Logo + Nav tabs */}
        <div className="flex items-center gap-5">
          <Link href="/portal" className="flex items-center gap-3 select-none group">
            <div className="w-9 h-9 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded-lg flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(188,156,69,0.35)] transition-shadow duration-300 shadow-[0_2px_6px_rgba(188,156,69,0.2)]">
              <span className="text-white font-bold text-lg leading-none font-[family-name:var(--font-playfair)] italic">R</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-white font-medium text-[14px] tracking-[4px] uppercase">
                REPRIME
              </span>
              <span className="font-[family-name:var(--font-playfair)] text-[#D4A843] italic text-[11px] font-normal">
                Terminal
              </span>
            </div>
          </Link>

          <div className="h-5 w-px bg-white/10 ml-1" />

          {/* Nav Tabs */}
          <div className="flex items-center gap-1 ml-1">
            {navTabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                locale={locale}
                className={`px-3.5 py-2 text-[11px] font-medium rounded-md transition-all ${
                  activeTab === tab.key
                    ? 'bg-white/[0.08] text-white border-b-2 border-[#D4A843]'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Voice Button */}
          <button
            onClick={() => setShowVoiceModal(true)}
            className="w-[34px] h-[34px] rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:border-[#D4A843]/40 transition-colors"
            aria-label="Ask Terminal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-[34px] h-[34px] rounded-full border border-[#EEF0F4] bg-white flex items-center justify-center hover:border-[#BC9C45] transition-colors relative"
              aria-label="Notifications"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#DC2626] countdown-pulse" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-[42px] w-[320px] bg-[#0F1419] rounded-xl shadow-2xl border border-white/[0.08] animate-slide-down z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-[13px] font-medium text-white">Notifications</span>
                  <button className="text-[11px] font-medium text-[#D4A843] hover:underline">
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.map((item, idx) => (
                    <div key={idx} className="px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-b-0 flex gap-3">
                      <span className="text-lg shrink-0">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium text-white">{item.title}</div>
                        <div className="text-[11px] text-white/50 truncate">{item.desc}</div>
                        <div className="text-[10px] text-white/25 mt-0.5">{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-white/10" />

          {/* Language toggle */}
          <div className="bg-white/[0.06] rounded-full p-0.5 inline-flex border border-white/[0.08]">
            <Link
              href={pathname}
              locale="en"
              className={`px-3.5 py-1.5 text-[11px] transition-all rounded-full ${
                locale === 'en'
                  ? 'bg-[#D4A843] text-[#07090F] font-semibold shadow-sm'
                  : 'text-white/40 font-medium hover:text-white/70'
              }`}
            >
              EN
            </Link>
            <Link
              href={pathname}
              locale="he"
              className={`px-3.5 py-1.5 text-[11px] transition-all rounded-full ${
                locale === 'he'
                  ? 'bg-[#D4A843] text-[#07090F] font-semibold shadow-sm'
                  : 'text-white/40 font-medium hover:text-white/70'
              }`}
            >
              עב
            </Link>
          </div>

          <div className="h-5 w-px bg-white/10" />

          {/* Member Badge */}
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-[12px] font-medium text-white">{firstName || 'Member'}</div>
              <div className="text-[9px] font-semibold text-[#D4A843] uppercase tracking-[2px]">MEMBER</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] flex items-center justify-center border border-[#D4A843]/30">
              <span className="text-white text-[13px] font-semibold">{initials}</span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="text-[11px] text-white/30 hover:text-[#DC2626] transition-colors cursor-pointer font-medium ml-1"
          >
            {tc('signOut')}
          </button>
        </div>
      </nav>

      {/* Voice Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[440px] p-8 relative animate-fade-up" style={{ animationDuration: '0.3s' }}>
            <button
              onClick={() => setShowVoiceModal(false)}
              className="absolute top-4 right-4 text-[#9CA3AF] hover:text-[#0E3470] transition-colors"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#BC9C45] to-[#D4B96A] flex items-center justify-center animate-glow">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>

              <h2 className="font-[family-name:var(--font-playfair)] text-[22px] font-bold text-[#0E3470] mt-5">
                Ask Terminal
              </h2>
              <p className="text-[13px] text-[#6B7280] text-center mt-2 max-w-[300px]">
                Ask anything about our active deals, market conditions, or your portfolio.
              </p>
              <p className="text-[12px] text-[#9CA3AF] italic text-center mt-3">
                &ldquo;What&apos;s the cap rate spread on the Memphis deal compared to submarket average?&rdquo;
              </p>

              <div className="flex items-end gap-1 h-10 mt-6">
                {[0.6, 0.9, 0.5, 1, 0.7, 0.4, 0.8].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-[#BC9C45] rounded-full audio-bar"
                    style={{
                      height: `${h * 40}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.5 + Math.random() * 0.5}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
