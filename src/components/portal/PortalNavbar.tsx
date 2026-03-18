'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Link, usePathname } from '@/i18n/navigation';

interface PortalNavbarProps {
  firstName: string;
  locale: string;
}

export default function PortalNavbar({ firstName, locale }: PortalNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  };

  return (
    <>
      {/* Gold accent strip — institutional signature line */}
      <div className="h-[3px] bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />

      <nav className="h-[72px] bg-white/95 backdrop-blur-sm border-b border-[#EEF0F4] px-8 flex items-center justify-between sticky top-0 z-50 shadow-[0_1px_3px_rgba(14,52,112,0.04),0_4px_12px_rgba(14,52,112,0.02)]">
        {/* Left: Logo */}
        <Link href="/portal" className="flex items-center gap-3 select-none group">
          {/* Gold "R" square */}
          <div className="w-9 h-9 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded-lg flex items-center justify-center group-hover:shadow-[0_0_16px_rgba(188,156,69,0.35)] transition-shadow duration-300 shadow-[0_2px_6px_rgba(188,156,69,0.2)]">
            <span className="text-white font-bold text-lg leading-none font-[family-name:var(--font-bodoni)] italic">R</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[#0E3470] font-semibold text-[15px] tracking-[3px] uppercase">
              REPRIME
            </span>
            <span className="font-[family-name:var(--font-bodoni)] text-[#BC9C45] italic text-[12px] font-normal">
              Terminal
            </span>
          </div>
          {/* Vertical gold rule separator */}
          <div className="h-5 w-px bg-[#ECD9A0] ml-2" />
          <span className="text-[9px] font-semibold tracking-[1.5px] uppercase text-[#9CA3AF] ml-1">
            Investor Portal
          </span>
        </Link>

        {/* Right: Language toggle, Welcome, Sign out */}
        <div className="flex items-center gap-5">
          {/* Language toggle — segmented control */}
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

          {/* Vertical separator */}
          <div className="h-5 w-px bg-[#EEF0F4]" />

          {/* Welcome text */}
          {firstName ? (
            <span className="text-[13px] text-[#6B7280]">
              Welcome, <span className="font-semibold text-[#0E3470]">{firstName}</span>
            </span>
          ) : null}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="text-[12px] text-[#9CA3AF] hover:text-[#DC2626] transition-colors cursor-pointer font-medium"
          >
            Sign Out
          </button>
        </div>
      </nav>
    </>
  );
}
