'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface DealSubNavProps {
  dealId: string;
  dealName: string;
  locale: string;
}

export default function DealSubNav({ dealId, dealName, locale }: DealSubNavProps) {
  const pathname = usePathname();
  const t = useTranslations('admin.dealSubNav');

  const tabs = [
    {
      key: 'edit',
      label: t('dealDetails'),
      href: `/${locale}/admin/deals/${dealId}`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      key: 'pipeline',
      label: t('pipeline'),
      href: `/${locale}/admin/deals/${dealId}/pipeline`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="6" r="2" />
          <circle cx="12" cy="6" r="2" />
          <circle cx="19" cy="18" r="2" />
          <path d="M5 8v2a4 4 0 004 4h2" />
          <path d="M12 8v2a4 4 0 004 4h1" />
        </svg>
      ),
    },
    {
      key: 'dataroom',
      label: t('dataRoom'),
      href: `/${locale}/admin/deals/${dealId}/dataroom`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      ),
    },
    {
      key: 'rent-roll',
      label: 'Rent Roll',
      href: `/${locale}/admin/deals/${dealId}/rent-roll`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 4v16" />
        </svg>
      ),
    },
    {
      key: 'capex',
      label: 'CapEx',
      href: `/${locale}/admin/deals/${dealId}/capex`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      key: 'exit-strategy',
      label: 'Exit Strategy',
      href: `/${locale}/admin/deals/${dealId}/exit-strategy`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      ),
    },
    {
      key: 'preview',
      label: t('previewAsInvestor'),
      href: `/${locale}/admin/deals/${dealId}/preview`,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      external: true,
    },
  ];

  function isActive(tab: typeof tabs[0]): boolean {
    if (tab.key === 'edit') {
      // Active for /deals/[id] but NOT for /deals/[id]/pipeline or /deals/[id]/dataroom
      return pathname.endsWith(dealId) || pathname.endsWith(`${dealId}/`);
    }
    return pathname.includes(`/${tab.key}`);
  }

  return (
    <div className="mb-6">
      {/* Deal name + back link */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/${locale}/admin/deals`}
          className="text-[13px] text-rp-gray-400 hover:text-rp-navy transition-colors flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {t('allDeals')}
        </Link>
        <div className="w-px h-4 bg-rp-gray-300" />
        <h1 className="text-[22px] font-bold text-rp-navy font-[family-name:var(--font-playfair)]">
          {dealName}
        </h1>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 bg-white rounded-xl border border-rp-gray-200 p-1.5">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Component = tab.external ? 'a' : Link;
          const extraProps = tab.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

          return (
            <Component
              key={tab.key}
              href={tab.href}
              {...extraProps}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-[13px] font-semibold transition-all flex-1 justify-center ${
                active
                  ? 'bg-rp-navy text-white shadow-sm'
                  : 'text-rp-gray-500 hover:bg-rp-gray-100 hover:text-rp-navy'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.external && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-50">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              )}
            </Component>
          );
        })}
      </div>
    </div>
  );
}
