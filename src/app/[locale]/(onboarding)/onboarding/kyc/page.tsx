import { redirect } from 'next/navigation';

// KYC was removed as a Terminal access requirement (per client direction).
// The page is kept as a redirect stub so any stale bookmarks or in-flight
// links resolve cleanly to the portal. The form/API/admin review code is
// preserved (dormant) under src/components/onboarding and src/app/api/onboarding
// in case KYC is re-introduced later.
export default async function OnboardingKYCPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/portal`);
}

export const dynamic = 'force-dynamic';
