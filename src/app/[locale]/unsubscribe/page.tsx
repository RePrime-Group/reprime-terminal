import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  new_deals: 'New Deals',
  document_uploads: 'Document Uploads',
  deal_activity: 'Deal Activity',
};

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; cat?: string }>;
}) {
  const { locale } = await params;
  const { status, cat } = await searchParams;
  const t = await getTranslations('unsubscribe');

  const success = status === 'ok';
  const categoryLabel = cat && CATEGORY_LABELS[cat] ? CATEGORY_LABELS[cat] : null;

  return (
    <div style={{ minHeight: '100vh', background: '#F2F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }}>
      <div style={{ maxWidth: '480px', width: '100%', background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 4px 24px rgba(14, 52, 112, 0.08)', overflow: 'hidden' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #BC9C45, #D4B96A, #BC9C45)' }} />
        <div style={{ padding: '40px 32px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#0E3470', margin: '0 0 16px 0' }}>
            {success ? t('successTitle') : t('invalidTitle')}
          </h1>
          <p style={{ fontSize: '15px', color: '#4B5563', lineHeight: '24px', margin: '0 0 24px 0' }}>
            {success
              ? categoryLabel
                ? t('successWithCategory', { category: categoryLabel })
                : t('successGeneric')
              : t('invalidBody')}
          </p>
          <Link
            href={`/${locale}/portal/settings`}
            style={{
              display: 'inline-block',
              backgroundColor: '#BC9C45',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              padding: '12px 32px',
              borderRadius: '10px',
              textDecoration: 'none',
            }}
          >
            {t('managePreferences')}
          </Link>
        </div>
      </div>
    </div>
  );
}
