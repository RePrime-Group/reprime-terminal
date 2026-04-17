'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import type { TerminalUser } from '@/lib/types/database';

interface AdminSidebarProps {
  user: Pick<TerminalUser, 'full_name' | 'role' | 'email'>;
  locale: string;
}

const navItems = [
  {
    labelKey: 'sidebar.deals' as const,
    href: '/admin/deals',
    ownerOnly: false,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="#0E3470" strokeWidth="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="#0E3470" strokeWidth="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="#0E3470" strokeWidth="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="#0E3470" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    labelKey: 'sidebar.investors' as const,
    href: '/admin/investors',
    ownerOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="6" r="3" stroke="#0E3470" strokeWidth="1.5" />
        <path d="M1.5 17c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="14" cy="7" r="2.5" stroke="#0E3470" strokeWidth="1.5" />
        <path d="M14 12c2.76 0 5 2.24 5 5" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    labelKey: 'sidebar.applications' as const,
    href: '/admin/applications',
    ownerOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="2" width="14" height="16" rx="2" stroke="#0E3470" strokeWidth="1.5" />
        <path d="M7 7h6M7 10.5h4" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 14h2" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    labelKey: 'sidebar.commitments' as const,
    href: '/admin/commitments',
    ownerOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2v6l4 2" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="8" stroke="#0E3470" strokeWidth="1.5" />
        <path d="M6.5 10.5l2 2 5-5" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    labelKey: 'sidebar.teamRequests' as const,
    href: '/admin/team-requests',
    ownerOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 17c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="6" r="3" stroke="#0E3470" strokeWidth="1.5" />
        <path d="M13.5 10.5l1.8 1.8 3.2-3.3" stroke="#BC9C45" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    labelKey: 'sidebar.activity' as const,
    href: '/admin/activity',
    ownerOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 17V10" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 17V7" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M11 17V11" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M15 17V4" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M3 13l4-5 4 3 6-8" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    labelKey: 'sidebar.settings' as const,
    href: '/admin/settings',
    ownerOnly: true,
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="2.5" stroke="#0E3470" strokeWidth="1.5" />
        <path d="M10 1.5v2M10 16.5v2M18.5 10h-2M3.5 10h-2M16 4l-1.4 1.4M5.4 14.6L4 16M16 16l-1.4-1.4M5.4 5.4L4 4" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function AdminSidebar({ user, locale }: AdminSidebarProps) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  const roleBadgeClass =
    user.role === 'owner'
      ? 'bg-rp-gold/10 text-rp-gold'
      : 'bg-rp-navy/10 text-rp-navy';

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-gradient-to-b from-white to-[#F7F8FA] border-r border-rp-gray-200 flex flex-col font-[var(--font-poppins)] z-40">
      {/* Logo */}
      <div className="pt-8 px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rp-gold flex items-center justify-center">
            <span className="font-[var(--font-playfair)] text-white text-xl italic font-bold leading-none">
              R
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-rp-navy text-[15px] font-semibold tracking-[3px] leading-tight">
              REPRIME
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-[family-name:var(--font-playfair)] text-[#BC9C45] text-[13px] italic leading-tight">
                Terminal
              </span>
              <span className="px-1.5 py-[1px] rounded bg-[#BC9C45] text-white text-[8px] font-bold uppercase tracking-[1.5px] leading-[1.3]">
                Beta
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-8 px-3 flex flex-col gap-1">
        {navItems
          .filter((item) => !item.ownerOnly || user.role === 'owner')
          .map((item) => {
            const fullHref = `/${locale}${item.href}`;
            const isActive = pathname.startsWith(fullHref);

            return (
              <Link
                key={item.href}
                href={fullHref}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
                  isActive
                    ? 'border-l-[3px] border-l-[#BC9C45] bg-[#FDF8ED]/50 text-[#0E3470] font-semibold'
                    : 'text-[#0E3470]/60 hover:bg-[#F7F8FA] hover:text-[#0E3470]'
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto px-4 pb-6 flex flex-col gap-4">
        {/* User info */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-rp-navy flex items-center justify-center">
            <span className="text-white text-[12px] font-medium">
              {user.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-medium text-rp-gray-700 truncate">
              {user.full_name}
            </span>
            <span
              className={`text-[11px] font-medium capitalize px-1.5 py-0.5 rounded-full w-fit ${roleBadgeClass}`}
            >
              {user.role}
            </span>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-rp-gray-400 hover:text-red-500 transition-colors rounded-lg"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <path d="M11 11l3-3-3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span>{tc('signOut')}</span>
        </button>
      </div>
    </aside>
  );
}
