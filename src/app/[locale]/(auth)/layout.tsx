import { getTranslations } from 'next-intl/server';
import BetaLaunchBanner from '@/components/BetaLaunchBanner';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('metaTitle') };
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* Auth pages have no header — pin the switcher top-right so invitees
          can change language before they have an account. */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher labels="full" />
      </div>
      <BetaLaunchBanner />
    </>
  );
}
