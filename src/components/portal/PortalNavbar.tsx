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
      <div className="h-[3px] bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />

      <nav className="h-[72px] bg-white/95 backdrop-blur-sm border-b border-[#EEF0F4] px-8 flex items-center justify-between sticky top-0 z-50 shadow-[0_1px_3px_rgba(14,52,112,0.04),0_4px_12px_rgba(14,52,112,0.02)]">
        {/* Left: Logo + Nav tabs */}
        <div className="flex items-center gap-5">
          <Link href="/portal" className="flex items-center gap-3 select-none group">
            <div className="w-9 h-9 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded-lg flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(188,156,69,0.35)] transition-shadow duration-300 shadow-[0_2px_6px_rgba(188,156,69,0.2)]">
              <span className="text-white font-bold text-lg leading-none font-[family-name:var(--font-playfair)] italic">R</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[#0E3470] font-semibold text-[15px] tracking-[3px] uppercase">
                REPRIME
              </span>
              <span className="font-[family-name:var(--font-playfair)] text-[#BC9C45] italic text-[12px] font-normal">
                Terminal
              </span>
            </div>
          </Link>

          <div className="h-5 w-px bg-[#ECD9A0] ml-1" />

          {/* Nav Tabs */}
          <div className="flex items-center gap-1 ml-1">
            {navTabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                locale={locale}
                className={`px-3.5 py-2 text-[11px] font-semibold rounded-md transition-all ${
                  activeTab === tab.key
                    ? 'bg-[#0E3470] text-white'
                    : 'text-[#6B7280] hover:text-[#0E3470] hover:bg-[#F7F8FA]'
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
            className="w-[34px] h-[34px] rounded-full border border-[#EEF0F4] bg-white flex items-center justify-center hover:border-[#BC9C45] transition-colors"
            aria-label="Ask Terminal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#DC2626] countdown-pulse" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-[42px] w-[320px] bg-white rounded-xl shadow-xl border border-[#EEF0F4] animate-slide-down z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#EEF0F4]">
                  <span className="text-[13px] font-semibold text-[#0E3470]">Notifications</span>
                  <button className="text-[11px] font-semibold text-[#BC9C45] hover:underline">
                    Mark all read
                  </button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.map((item, idx) => (
                    <div key={idx} className="px-4 py-3 hover:bg-[#F7F8FA] transition-colors border-b border-[#EEF0F4] last:border-b-0 flex gap-3">
                      <span className="text-lg shrink-0">{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-[#0E3470]">{item.title}</div>
                        <div className="text-[11px] text-[#6B7280] truncate">{item.desc}</div>
                        <div className="text-[10px] text-[#9CA3AF] mt-0.5">{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-[#EEF0F4]" />

          {/* Language toggle */}
          <div className="bg-[#F7F8FA] rounded-full p-0.5 inline-flex border border-[#EEF0F4]">
            <Link
              href={pathname}
              locale="en"
              className={`px-3.5 py-1.5 text-[11px] transition-all rounded-full ${
                locale === 'en'
                  ? 'bg-[#0E3470] text-white font-semibold shadow-sm'
                  : 'text-[#9CA3AF] font-medium hover:text-[#0E3470]'
              }`}
            >
              EN
            </Link>
            <Link
              href={pathname}
              locale="he"
              className={`px-3.5 py-1.5 text-[11px] transition-all rounded-full ${
                locale === 'he'
                  ? 'bg-[#0E3470] text-white font-semibold shadow-sm'
                  : 'text-[#9CA3AF] font-medium hover:text-[#0E3470]'
              }`}
            >
              עב
            </Link>
          </div>

          <div className="h-5 w-px bg-[#EEF0F4]" />

          {/* Member Badge */}
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-[12px] font-semibold text-[#0E3470]">{firstName || 'Member'}</div>
              <div className="text-[9px] font-bold text-[#BC9C45] uppercase tracking-[1.5px]">MEMBER</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center border-2 border-[#BC9C45]">
              <span className="text-white text-[13px] font-semibold">{initials}</span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="text-[11px] text-[#9CA3AF] hover:text-[#DC2626] transition-colors cursor-pointer font-medium ml-1"
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
