'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Link, usePathname } from '@/i18n/navigation';
import Image from 'next/image';

interface PortalNavbarProps {
  firstName: string;
  locale: string;
}

export default function PortalNavbar({ firstName, locale }: PortalNavbarProps) {
  const t = useTranslations('portal');
  const tn = useTranslations('portal.navbar');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = pathname.startsWith('/portal/portfolio')
    ? 'portfolio'
    : pathname.startsWith('/portal/compare')
      ? 'compare'
      : 'dashboard';
  const supabase = createClient();
  const [showNotifications, setShowNotifications] = useState(false);
  // Voice modal removed for v1 launch
  const [notifications, setNotifications] = useState<{ title: string; description: string; created_at: string; type: string }[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileMenuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileMenuOpen]);

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    async function fetchNotifications() {
      const { data } = await supabase
        .from('terminal_notifications')
        .select('title, description, created_at, type, read_at')
        .order('created_at', { ascending: false })
        .limit(8);

      if (data) {
        setNotifications(data);
        setHasUnread(data.some((n: { read_at: string | null }) => !n.read_at));
      }
    }
    fetchNotifications();
  }, [supabase]);

  const handleSignOut = async () => {
    setSigningOut(true);
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
    { key: 'portfolio', label: tn('portfolio'), href: '/portal/portfolio' },
    { key: 'compare', label: tn('compare'), href: '/portal/compare' },
  ];

  return (
    <>
      {/* Gold accent strip */}
      <div className="h-[2px] bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />

      <nav className="h-[64px] bg-[#07090F]/95 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between sticky top-0 z-50 border-b border-white/[0.06]">
        {/* Left: Logo + Nav tabs */}
        <div className="flex items-center gap-3 md:gap-5">
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

          <div className="hidden md:block h-5 w-px bg-white/10 ml-1" />

          {/* Nav Tabs (desktop) */}
          <div className="hidden md:flex items-center gap-1 ml-1" data-tour="nav-tabs">
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
        <div className="flex items-center gap-2 md:gap-3">
          {/* Notification Bell — wrapper is static on mobile so dropdown anchors to the sticky nav */}
          <div className="md:relative" ref={notifRef} data-tour="notif-bell">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-[44px] h-[44px] md:w-[34px] md:h-[34px] rounded-full border border-white/[0.08] bg-white/[0.06] flex items-center justify-center hover:border-[#BC9C45] transition-colors relative"
              aria-label="Notifications"
            >
              <Image src="/images/notification_logo.png" alt="Notifications" width={28} height={28} className="rounded-full" />
              {hasUnread && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#DC2626] countdown-pulse" />}
            </button>

            {showNotifications && (
              <div className="absolute top-full md:top-[42px] left-2 right-2 md:left-auto md:right-0 mt-1 md:mt-0 w-auto md:w-[320px] bg-[#0F1419] rounded-xl shadow-2xl border border-white/[0.08] animate-slide-down z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-[13px] font-medium text-white">{tn('notifications')}</span>
                  {hasUnread && (
                    <button
                      onClick={async () => {
                        if (markingRead) return;
                        setMarkingRead(true);
                        try {
                          await supabase.from('terminal_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
                          setHasUnread(false);
                        } finally {
                          setMarkingRead(false);
                        }
                      }}
                      disabled={markingRead}
                      className="text-[11px] font-medium text-[#D4A843] hover:underline disabled:opacity-50 flex items-center gap-1"
                    >
                      {markingRead && <div className="w-2.5 h-2.5 border-[1.5px] border-[#D4A843] border-t-transparent rounded-full animate-spin" />}
                      {tn('markAllRead')}
                    </button>
                  )}
                </div>
                <div className="max-h-[min(60dvh,320px)] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[12px] text-white/30">
                      {tn('noNotifications')}
                    </div>
                  ) : (
                    notifications.map((item, idx) => {
                      const iconMap: Record<string, string> = {
                        deal_status_change: '🏢',
                        document_uploaded: '📄',
                        meeting_confirmed: '📅',
                        subscription_alert: '🔔',
                      };
                      const icon = iconMap[item.type] ?? '📌';
                      const timeAgo = (() => {
                        const diff = Date.now() - new Date(item.created_at).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return tn('justNow');
                        if (mins < 60) return tn('minutesAgo', { count: mins });
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return tn('hoursAgo', { count: hrs });
                        const days = Math.floor(hrs / 24);
                        return tn('daysAgo', { count: days });
                      })();

                      return (
                        <div key={idx} className="px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-b-0 flex gap-3">
                          <span className="text-lg shrink-0">{icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-medium text-white">{item.title}</div>
                            <div className="text-[11px] text-white/50 truncate">{item.description}</div>
                            <div className="text-[10px] text-white/25 mt-0.5">{timeAgo}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:block h-5 w-px bg-white/10" />

          {/* Language toggle */}
          <div className="hidden md:inline-flex bg-white/[0.06] rounded-full p-0.5 border border-white/[0.08]">
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

          <div className="hidden md:block h-5 w-px bg-white/10" />

          {/* Member Badge (desktop) */}
          <div className="hidden md:flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-[12px] font-medium text-white">{firstName || tn('member')}</div>
              <div className="text-[9px] font-semibold text-[#D4A843] uppercase tracking-[2px]">{tn('member')}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] flex items-center justify-center border border-[#D4A843]/30">
              <span className="text-white text-[13px] font-semibold">{initials}</span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="hidden md:inline-flex text-[11px] text-white/30 hover:text-[#DC2626] transition-colors cursor-pointer font-medium ml-1 disabled:opacity-50 items-center gap-1"
          >
            {signingOut && <div className="w-2.5 h-2.5 border-[1.5px] border-white/30 border-t-transparent rounded-full animate-spin" />}
            {signingOut ? tc('signingOut') : tc('signOut')}
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="md:hidden w-[44px] h-[44px] rounded-full border border-white/[0.08] bg-white/[0.06] flex items-center justify-center hover:border-[#BC9C45] transition-colors"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            )}
          </button>
        </div>

      {/* Mobile drawer — sibling of nav content, anchored to bottom of sticky nav via absolute */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 max-h-[calc(100dvh-64px)] z-40 bg-[#07090F]/98 backdrop-blur-xl border-t border-white/[0.06] animate-slide-down overflow-y-auto">
          <div className="px-4 py-5 flex flex-col gap-1">
            {navTabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                locale={locale}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 min-h-[44px] flex items-center text-[14px] font-medium rounded-md transition-all ${
                  activeTab === tab.key
                    ? 'bg-white/[0.08] text-white border-l-2 border-[#D4A843]'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {tab.label}
              </Link>
            ))}

            <div className="h-px bg-white/[0.08] my-3" />

            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[2px] text-white/40">{tn('member')}</span>
              <div className="bg-white/[0.06] rounded-full p-0.5 inline-flex border border-white/[0.08]">
                <Link
                  href={pathname}
                  locale="en"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2 min-h-[36px] text-[12px] transition-all rounded-full ${
                    locale === 'en' ? 'bg-[#D4A843] text-[#07090F] font-semibold' : 'text-white/50 font-medium'
                  }`}
                >EN</Link>
                <Link
                  href={pathname}
                  locale="he"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2 min-h-[36px] text-[12px] transition-all rounded-full ${
                    locale === 'he' ? 'bg-[#D4A843] text-[#07090F] font-semibold' : 'text-white/50 font-medium'
                  }`}
                >עב</Link>
              </div>
            </div>

            <div className="flex items-center gap-3 px-1 py-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] flex items-center justify-center border border-[#D4A843]/30">
                <span className="text-white text-[14px] font-semibold">{initials}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-white truncate">{firstName || tn('member')}</div>
                <div className="text-[9px] font-semibold text-[#D4A843] uppercase tracking-[2px]">{tn('member')}</div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="min-h-[44px] px-4 text-[13px] text-left text-white/60 hover:text-[#DC2626] hover:bg-white/[0.04] rounded-md transition-colors font-medium disabled:opacity-50 inline-flex items-center gap-2"
            >
              {signingOut && <div className="w-3 h-3 border-[1.5px] border-white/30 border-t-transparent rounded-full animate-spin" />}
              {signingOut ? tc('signingOut') : tc('signOut')}
            </button>
          </div>
        </div>
      )}
      </nav>
    </>
  );
}
