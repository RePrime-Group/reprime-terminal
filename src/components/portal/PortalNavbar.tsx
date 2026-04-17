'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Link, usePathname } from '@/i18n/navigation';
import Image from 'next/image';

interface PortalNavbarProps {
  firstName: string;
  fullName?: string;
  email?: string;
  locale: string;
}

export default function PortalNavbar({ firstName, fullName, email, locale }: PortalNavbarProps) {
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
  const [notifications, setNotifications] = useState<{ id: string; title: string; description: string; created_at: string; type: string; deal_id: string | null; read_at: string | null }[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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
        .select('id, title, description, created_at, type, deal_id, read_at')
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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setUserMenuOpen(false); }, [pathname]);

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
              <span className="px-1.5 py-[2px] rounded bg-[#BC9C45] text-[#07090F] text-[8px] font-bold uppercase tracking-[1.5px] leading-none self-center">
                Beta
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
                          const { error } = await supabase
                            .from('terminal_notifications')
                            .update({ read_at: new Date().toISOString() })
                            .is('read_at', null);
                          if (error) {
                            console.error('mark all read failed:', error);
                            // Leave hasUnread true so the user can retry.
                          } else {
                            setHasUnread(false);
                          }
                        } catch (err) {
                          console.error('mark all read failed:', err);
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
                    notifications.map((item) => {
                      const iconMap: Record<string, string> = {
                        new_deal: '🏢',
                        deal_status_change: '🏢',
                        deal_activity: '📈',
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

                      const targetHref = item.deal_id
                        ? item.type === 'document_uploaded'
                          ? `/${locale}/portal/deals/${item.deal_id}?tab=due-diligence`
                          : `/${locale}/portal/deals/${item.deal_id}`
                        : null;

                      const handleClick = async () => {
                        setShowNotifications(false);
                        if (!item.read_at) {
                          setNotifications((prev) =>
                            prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)),
                          );
                          supabase
                            .from('terminal_notifications')
                            .update({ read_at: new Date().toISOString() })
                            .eq('id', item.id)
                            .then(() => {
                              setHasUnread((prev) => {
                                if (!prev) return prev;
                                return notifications.some((n) => n.id !== item.id && !n.read_at);
                              });
                            });
                        }
                        if (targetHref) router.push(targetHref);
                      };

                      const content = (
                        <>
                          <span className="text-lg shrink-0">{icon}</span>
                          <div className="min-w-0 flex-1 text-start">
                            <div className={`text-[12px] font-medium ${item.read_at ? 'text-white/70' : 'text-white'}`}>{item.title}</div>
                            <div className="text-[11px] text-white/50 truncate">{item.description}</div>
                            <div className="text-[10px] text-white/25 mt-0.5">{timeAgo}</div>
                          </div>
                          {!item.read_at && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D4A843] shrink-0 mt-1.5" aria-label="Unread" />
                          )}
                        </>
                      );

                      const rowClass = `w-full px-4 py-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-b-0 flex gap-3 ${
                        targetHref ? 'cursor-pointer' : 'cursor-default'
                      }`;

                      return targetHref ? (
                        <button
                          key={item.id}
                          type="button"
                          onClick={handleClick}
                          className={rowClass}
                        >
                          {content}
                        </button>
                      ) : (
                        <div key={item.id} className={rowClass}>
                          {content}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden md:block h-5 w-px bg-white/10" />

          {/* Member menu (desktop) */}
          <div className="hidden md:block relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className="flex items-center gap-2.5 group rounded-full pl-3 pr-2 py-1 hover:bg-white/[0.04] transition-colors"
            >
              <div className="text-right">
                <div className="text-[12px] font-medium text-white group-hover:text-[#D4A843] transition-colors">{firstName || tn('member')}</div>
                <div className="text-[9px] font-semibold text-[#D4A843] uppercase tracking-[2px]">{tn('member')}</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] flex items-center justify-center border border-[#D4A843]/30 group-hover:shadow-[0_0_12px_rgba(212,168,67,0.4)] transition-shadow">
                <span className="text-white text-[13px] font-semibold">{initials}</span>
              </div>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-white/50 group-hover:text-white/80 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+10px)] w-[280px] bg-[#0F1419] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/[0.08] animate-slide-down z-50 overflow-hidden"
              >
                {/* Header: avatar + name + email */}
                <div className="px-5 py-4 bg-gradient-to-br from-white/[0.03] to-transparent border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] flex items-center justify-center border border-[#D4A843]/30 shrink-0">
                      <span className="text-white text-[15px] font-semibold">{initials}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold text-white truncate">
                        {fullName || firstName || tn('member')}
                      </div>
                      {email && (
                        <div className="text-[11px] text-white/50 truncate mt-0.5">{email}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  <Link
                    href="/portal/settings"
                    locale={locale}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-5 py-3 text-[13px] text-white hover:bg-white/[0.05] transition-colors group"
                    role="menuitem"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white/60 group-hover:text-[#D4A843] transition-colors shrink-0">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                    </svg>
                    <span className="flex-1">{tn('settings')}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 group-hover:text-white/60 transition-colors">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </div>

                <div className="h-px bg-white/[0.06]" />

                <div className="py-1.5">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="w-full flex items-center gap-3 px-5 py-3 text-[13px] text-white/70 hover:text-[#F87171] hover:bg-[#F87171]/[0.06] transition-colors disabled:opacity-50"
                    role="menuitem"
                  >
                    {signingOut ? (
                      <div className="w-[17px] h-[17px] border-[1.5px] border-white/30 border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    )}
                    <span>{signingOut ? tc('signingOut') : tc('signOut')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

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

            <Link
              href="/portal/settings"
              locale={locale}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-1 py-3 rounded-md hover:bg-white/[0.04] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] flex items-center justify-center border border-[#D4A843]/30">
                <span className="text-white text-[14px] font-semibold">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-white truncate">{firstName || tn('member')}</div>
                <div className="text-[9px] font-semibold text-[#D4A843] uppercase tracking-[2px]">{tn('settings')}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>

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
