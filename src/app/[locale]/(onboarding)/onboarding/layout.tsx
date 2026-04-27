import { redirect } from 'next/navigation';
import { getCurrentAuthUser, getCurrentProfile } from '@/lib/supabase/currentUser';
import OnboardingSignOutButton from '@/components/onboarding/OnboardingSignOutButton';

export default async function OnboardingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const [user, terminalUser] = await Promise.all([
    getCurrentAuthUser(),
    getCurrentProfile(),
  ]);

  if (!user) redirect(`/${locale}/login`);
  if (!terminalUser) redirect(`/${locale}/login`);
  // Owners and employees use admin routes; they're not subject to NDA/KYC.
  if (terminalUser.role !== 'investor') redirect(`/${locale}/admin`);

  return (
    <div className="min-h-dvh rp-page-texture flex flex-col">
      {/* Gold accent strip — matches portal navbar */}
      <div className="h-[2px] bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45] shrink-0" />

      {/* Minimal top bar — logo + sign out only */}
      <header className="shrink-0 border-b border-[#EEF0F4] bg-white">
        <div className="max-w-[1200px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#BC9C45] to-[#D4B96A] flex items-center justify-center">
              <span className="text-white text-[14px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
            </div>
            <span className="text-[13px] font-semibold text-[#0E3470] tracking-[0.5px]">REPRIME TERMINAL</span>
          </div>
          <OnboardingSignOutButton locale={locale} />
        </div>
      </header>

      <main className="flex-1 flex items-stretch justify-center py-8 px-4">
        {children}
      </main>
    </div>
  );
}
