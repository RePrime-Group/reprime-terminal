import { redirect } from 'next/navigation';
import { getOnboardingState, nextOnboardingPath } from '@/lib/kyc/onboardingState';
import OnboardingNDAClient from '@/components/onboarding/OnboardingNDAClient';

export default async function OnboardingNDAPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const state = await getOnboardingState();

  // Layout already gates auth + investor role, but null-check defensively.
  if (!state) redirect(`/${locale}/login`);

  // If the user has already signed the blanket NDA, send them to whatever
  // the next step is (KYC, pending, or home).
  if (state.hasBlanketNDA) {
    const next = nextOnboardingPath(state, locale);
    redirect(next ?? `/${locale}/portal`);
  }

  return <OnboardingNDAClient locale={locale} />;
}
