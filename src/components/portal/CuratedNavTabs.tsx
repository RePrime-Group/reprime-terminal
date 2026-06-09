'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export interface CuratedNavGroup {
  id: string;
  name: string;
}

/**
 * Renders one named nav entry per enabled group the user belongs to. Up to two
 * show inline; three or more collapse into a single "Pipelines ▾" dropdown.
 * Used in both the desktop bar and the mobile drawer of PortalNavbar.
 */
export default function CuratedNavTabs({
  groups,
  locale,
  variant,
}: {
  groups: CuratedNavGroup[];
  locale: string;
  variant: 'desktop' | 'mobile';
}) {
  const t = useTranslations('portal.navbar');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (groups.length === 0) return null;

  const isActive = (id: string) => pathname.startsWith(`/portal/curated/${id}`);
  const anyActive = pathname.startsWith('/portal/curated');

  // ── Mobile: always list each group as a plain link ──
  if (variant === 'mobile') {
    return (
      <>
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/portal/curated/${g.id}`}
            locale={locale}
            className={`px-4 min-h-[44px] flex items-center text-[14px] font-medium rounded-md transition-all ${
              isActive(g.id)
                ? 'bg-white/[0.08] text-white border-l-2 border-[#D4A843]'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {g.name}
          </Link>
        ))}
      </>
    );
  }

  // ── Desktop: up to 2 inline, 3+ collapse into a dropdown ──
  const pillBase = 'px-5 py-2 text-[17px] font-semibold rounded-full border-2 transition-all';
  const pillActive = 'bg-white/[0.06] border-[#D4A843] text-white shadow-[0_0_18px_rgba(188,156,69,0.2)]';
  const pillIdle =
    'bg-white/[0.04] border-transparent text-white/80 hover:bg-white/[0.08] hover:border-white/10 hover:text-white';

  if (groups.length <= 2) {
    return (
      <>
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/portal/curated/${g.id}`}
            locale={locale}
            className={`${pillBase} ${isActive(g.id) ? pillActive : pillIdle}`}
          >
            {g.name}
          </Link>
        ))}
      </>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${pillBase} inline-flex items-center gap-1.5 ${anyActive ? pillActive : pillIdle}`}
      >
        {t('pipelines')}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+10px)] w-[240px] bg-[#0F1419] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/[0.08] py-1.5 z-50 max-h-[60vh] overflow-y-auto">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/portal/curated/${g.id}`}
              locale={locale}
              onClick={() => setOpen(false)}
              className={`block px-5 py-3 text-[14px] transition-colors ${
                isActive(g.id)
                  ? 'text-white bg-white/[0.06]'
                  : 'text-white/75 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
