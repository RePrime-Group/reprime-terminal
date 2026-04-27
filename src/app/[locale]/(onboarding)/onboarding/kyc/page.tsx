import { redirect } from 'next/navigation';
import { getCurrentAuthUser, getCurrentProfile } from '@/lib/supabase/currentUser';
import { createClient } from '@/lib/supabase/server';
import { getOnboardingState } from '@/lib/kyc/onboardingState';
import KYCFormClient from '@/components/onboarding/KYCFormClient';
import { bufferFromBytea, decryptSSN, maskSSN } from '@/lib/kyc/encryption';
import type { KYCFormData } from '@/lib/kyc/types';

export default async function OnboardingKYCPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [user, profile, state] = await Promise.all([
    getCurrentAuthUser(),
    getCurrentProfile(),
    getOnboardingState(),
  ]);

  if (!user || !profile || !state) redirect(`/${locale}/login`);

  // Send the user to the right place if they're not at the KYC step.
  if (!state.hasBlanketNDA) redirect(`/${locale}/onboarding/nda`);
  if (state.kyc?.completedAt) {
    redirect(state.kyc.approved ? `/${locale}/portal` : `/${locale}/onboarding/pending`);
  }

  // Pre-fill from any prior partial save. SSN itself never leaves the
  // server in plaintext — we decrypt server-side just to mask the last 4
  // digits and hand the mask to the client as a display indicator.
  const supabase = await createClient();
  const { data: kyc } = await supabase
    .from('terminal_user_kyc')
    .select('data, ssn_encrypted')
    .eq('user_id', user.id)
    .maybeSingle();
  const initialData = (kyc?.data ?? null) as KYCFormData | null;

  let savedSSNMask: string | null = null;
  if (kyc?.ssn_encrypted) {
    try {
      savedSSNMask = maskSSN(decryptSSN(bufferFromBytea(kyc.ssn_encrypted)));
    } catch {
      // Decryption failure shouldn't block the form — fall back to "no saved SSN"
      // and let the user re-enter. (Watch the server log for the underlying error.)
      savedSSNMask = null;
    }
  }

  return (
    <KYCFormClient
      locale={locale}
      initialData={initialData}
      userEmail={user.email ?? ''}
      defaultLegalName={profile.full_name ?? ''}
      savedSSNMask={savedSSNMask}
    />
  );
}

export const dynamic = 'force-dynamic';
