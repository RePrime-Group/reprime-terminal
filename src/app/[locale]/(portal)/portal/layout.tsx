import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PortalNavbar from '@/components/portal/PortalNavbar';
import MarketTicker from '@/components/portal/MarketTicker';
import OnboardingOverlay from '@/components/portal/OnboardingOverlay';

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const { data: terminalUser } = await supabase
    .from('terminal_users')
    .select('role, full_name, onboarding_completed')
    .eq('id', user.id)
    .single();

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
    </div>
  );
}
