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

  const toggleLocale = locale === 'en' ? 'he' : 'en';

  return (
    <nav className="h-16 bg-white border-b border-rp-gray-200 px-6 flex items-center justify-between sticky top-0 z-50">
      {/* Left: Logo */}
      <Link href="/portal" className="flex items-center gap-2.5 select-none">
        {/* Gold "R" square */}
        <div className="w-8 h-8 bg-rp-gold rounded-md flex items-center justify-center hover:shadow-[0_0_12px_rgba(188,156,69,0.3)] transition-shadow duration-300">
          <span className="text-white font-bold text-lg leading-none">R</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-rp-navy font-semibold text-[15px] tracking-[3px] uppercase">
            REPRIME
          </span>
          <span className="font-[family-name:var(--font-bodoni)] text-[#BC9C45] italic text-[11px] font-normal">
            Terminal
          </span>
        </div>
      </Link>

      {/* Right: Language toggle, Welcome, Sign out */}
      <div className="flex items-center gap-6">
        {/* Language toggle — segmented control */}
        <div className="bg-[#F7F8FA] rounded-full p-0.5 inline-flex">
          <Link
            href={pathname}
            locale="en"
            className={`px-3 py-1 text-xs transition-colors rounded-full ${
              locale === 'en'
                ? 'bg-[#0E3470] text-white font-semibold'
                : 'text-[#9CA3AF] font-medium hover:text-[#0E3470]'
            }`}
          >
            EN
          </Link>
          <Link
            href={pathname}
            locale="he"
            className={`px-3 py-1 text-xs transition-colors rounded-full ${
              locale === 'he'
                ? 'bg-[#0E3470] text-white font-semibold'
                : 'text-[#9CA3AF] font-medium hover:text-[#0E3470]'
            }`}
          >
            עב
          </Link>
        </div>

        {/* Welcome text */}
        {firstName ? (
          <span className="text-sm text-rp-gray-600">
            Welcome, <span className="font-medium">{firstName}</span>
          </span>
        ) : null}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="text-sm text-rp-gray-400 hover:text-rp-red transition-colors cursor-pointer"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
