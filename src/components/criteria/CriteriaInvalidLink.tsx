'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import RePrimeLogo from '@/components/RePrimeLogo';

interface CriteriaInvalidLinkProps {
  locale: string;
  reason: 'missing' | 'used' | 'unknown';
}

export default function CriteriaInvalidLink({ locale, reason }: CriteriaInvalidLinkProps) {
  const t = useTranslations('criteria.invalid');

  return (
    <div className="min-h-screen flex flex-col rp-page-texture">
      <nav className="flex items-center justify-between px-5 md:px-10 py-4 md:py-6">
        <div className="flex items-center gap-2 min-w-0">
          <RePrimeLogo width={180} variant="navy" />
          <span className="px-1.5 py-[2px] rounded bg-rp-gold text-white text-[8px] font-bold uppercase tracking-[1.5px] leading-none">
            Beta
          </span>
        </div>
        <Link
          href="/login"
          locale={locale}
          className="shrink-0 px-3.5 md:px-5 py-2 border border-rp-gray-200 text-rp-navy text-[12px] font-medium rounded-lg hover:border-rp-gold/40 transition-colors"
        >
          {t('signIn')}
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-5 md:px-10 py-12">
        <div className="max-w-[520px] text-center bg-white border border-rp-gray-200 rp-card-shadow rounded-2xl p-8 md:p-10">
          <div className="w-14 h-14 mx-auto rounded-full bg-rp-gold-bg flex items-center justify-center mb-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-rp-navy mb-3">
            {t('title')}
          </h1>
          <p className="text-[14px] text-rp-gray-600 leading-relaxed mb-2">
            {reason === 'used' ? t('bodyUsed') : reason === 'unknown' ? t('bodyUnknown') : t('bodyMissing')}
          </p>
          <p className="text-[13px] text-rp-gray-500 mb-6">{t('contactLine')}</p>
          <Link
            href="/login"
            locale={locale}
            className="inline-block px-5 py-2.5 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-[14px] font-semibold hover:opacity-90"
          >
            {t('returnToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
