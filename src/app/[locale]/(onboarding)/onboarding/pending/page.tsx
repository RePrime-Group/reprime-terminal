import { redirect } from 'next/navigation';

// "Application under review" was a KYC-approval state. KYC is no longer a
// gate to access the Terminal, so this URL just bounces investors back to
// the portal.
export default async function OnboardingPendingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/portal`);
}

export const dynamic = 'force-dynamic';
