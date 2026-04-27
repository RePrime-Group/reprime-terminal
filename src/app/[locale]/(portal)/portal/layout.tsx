import { redirect } from 'next/navigation';
import { getCurrentAuthUser, getCurrentProfile } from '@/lib/supabase/currentUser';
import { getOnboardingState, nextOnboardingPath } from '@/lib/kyc/onboardingState';
import PortalNavbar from '@/components/portal/PortalNavbar';
import MarketTicker from '@/components/portal/MarketTicker';
import OnboardingOverlay from '@/components/portal/OnboardingOverlay';
import BetaLaunchBanner from '@/components/BetaLaunchBanner';

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Parallelise auth + profile + onboarding state — all are cached per-request
  // so pages in the same render pass will not re-fetch them.
  const [user, terminalUser, onboarding] = await Promise.all([
    getCurrentAuthUser(),
    getCurrentProfile(),
    getOnboardingState(),
  ]);

  if (!user) redirect(`/${locale}/login`);
  if (!terminalUser) redirect(`/${locale}/login`);
  if (terminalUser.role !== 'investor') redirect(`/${locale}/admin`);

  // NDA/KYC gate — investors must sign blanket NDA and complete KYC before
  // any portal content loads. The /onboarding/* routes are exempt because
  // they live in a different route group and don't render this layout.
  if (onboarding) {
    const next = nextOnboardingPath(onboarding, locale);
    if (next) redirect(next);
  }

  return (
    <div className="min-h-dvh rp-page-texture overflow-x-hidden">
      <MarketTicker />
      <PortalNavbar
        firstName={terminalUser.full_name?.split(' ')[0] ?? ''}
        fullName={terminalUser.full_name ?? ''}
        email={user.email ?? ''}
        locale={locale}
        accessTier={(terminalUser as { access_tier?: 'investor' | 'marketplace_only' | null }).access_tier ?? 'investor'}
      />
      {!terminalUser.onboarding_completed && (
        <OnboardingOverlay
          firstName={terminalUser.full_name?.split(' ')[0] ?? ''}
          userId={user.id}
        />
      )}
      <main>
        {children}
      </main>
      <BetaLaunchBanner />
    </div>
  );
}
