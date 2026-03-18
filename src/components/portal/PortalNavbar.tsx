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
        <div className="w-8 h-8 bg-rp-gold rounded-md flex items-center justify-center">
          <span className="text-white font-bold text-lg leading-none">R</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-rp-navy font-bold text-[15px] tracking-[0.08em] uppercase">
            REPRIME
          </span>
          <span className="font-[family-name:var(--font-bodoni)] text-rp-gold italic text-[15px] font-normal">
            Terminal
          </span>
        </div>
      </Link>

      {/* Right: Language toggle, Welcome, Sign out */}
      <div className="flex items-center gap-6">
        {/* Language toggle */}
        <Link
          href={pathname}
          locale={toggleLocale}
          className="text-sm text-rp-gray-500 hover:text-rp-navy transition-colors"
        >
          {locale === 'en' ? (
            <span>EN | <span className="font-medium">עב</span></span>
          ) : (
            <span><span className="font-medium">EN</span> | עב</span>
          )}
        </Link>

        {/* Welcome text */}
        <span className="text-sm text-rp-gray-600">
          Welcome, <span className="font-medium">{firstName}</span>
        </span>

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
