import { redirect } from 'next/navigation';
import { getCurrentAuthUser, getCurrentProfile } from '@/lib/supabase/currentUser';
import { getOnboardingState, nextOnboardingPath } from '@/lib/kyc/onboardingState';
import WelcomeClient from './WelcomeClient';

export const dynamic = 'force-dynamic';

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const [user, profile] = await Promise.all([
    getCurrentAuthUser(),
    getCurrentProfile(),
  ]);

  // Unauthenticated visits fall through to login.
  if (!user || !profile) redirect(`/${locale}/login`);

  // Owners/employees don't belong here — send to admin.
  if (profile.role !== 'investor') redirect(`/${locale}/admin`);

  // Investors must finish NDA + KYC before any post-signup celebration page.
  // If they're not fully onboarded yet, route to the right step.
  const state = await getOnboardingState();
  if (state) {
    const next = nextOnboardingPath(state, locale);
    if (next) redirect(next);
  }

  return <WelcomeClient />;
}
