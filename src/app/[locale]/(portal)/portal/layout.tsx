import { redirect } from 'next/navigation';
import { getCurrentAuthUser, getCurrentProfile } from '@/lib/supabase/currentUser';
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

  // Parallelise auth + profile — both are cached per-request so pages in the
  // same render pass will not re-fetch them.
  const [user, terminalUser] = await Promise.all([
    getCurrentAuthUser(),
    getCurrentProfile(),
  ]);

  if (!user) redirect(`/${locale}/login`);
  if (!terminalUser) redirect(`/${locale}/login`);
  if (terminalUser.role !== 'investor') redirect(`/${locale}/admin`);

  return (
    <div className="min-h-dvh rp-page-texture overflow-x-hidden">
      <MarketTicker />
      <PortalNavbar
        firstName={terminalUser.full_name?.split(' ')[0] ?? ''}
        fullName={terminalUser.full_name ?? ''}
        email={user.email ?? ''}
        locale={locale}
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
