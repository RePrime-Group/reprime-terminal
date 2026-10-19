import { getLocale, getTranslations } from 'next-intl/server';

// Localized 404 for everything under /[locale]. Unmatched URLs reach it via
// the [...rest] catch-all; pages calling notFound() land here directly.
export default async function LocaleNotFound() {
  const locale = await getLocale();
  const t = await getTranslations('errors');
  return (
    <div className="min-h-screen bg-rp-page-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-rp-gold to-rp-gold-soft rounded-lg flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-2xl font-[family-name:var(--font-playfair)] font-extrabold">R</span>
        </div>
        <h1 className="text-3xl font-bold text-rp-navy mb-2">{t('notFound')}</h1>
        <p className="text-rp-gray-500 mb-8">{t('pageMissing')}</p>
        <a
          href={`/${locale}`}
          className="inline-flex items-center px-6 py-3 bg-rp-navy text-white rounded-lg font-semibold text-sm hover:bg-rp-navy/90 transition-all duration-200"
        >
          {t('returnToDashboard')}
        </a>
      </div>
    </div>
  );
}
