import { redirect } from 'next/navigation';
import { getOnboardingState } from '@/lib/kyc/onboardingState';

export default async function OnboardingPendingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const state = await getOnboardingState();
  if (!state) redirect(`/${locale}/login`);

  // Send the user to the right place if they don't belong on the pending page.
  if (!state.hasBlanketNDA) redirect(`/${locale}/onboarding/nda`);
  if (!state.kyc?.completedAt) redirect(`/${locale}/onboarding/kyc`);
  if (state.kyc.approved) redirect(`/${locale}/portal`);

  const wasRejected = !!state.kyc.rejectedAt;

  return (
    <div className="w-full max-w-[520px] mx-auto self-center">
      <div className="bg-white rounded-2xl border border-[#EEF0F4] rp-card-shadow p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[#FDF8ED] mx-auto mb-5 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h1 className="font-[family-name:var(--font-playfair)] text-[22px] font-semibold text-[#0E3470] mb-2">
          {wasRejected ? 'Application Not Approved' : 'Application Under Review'}
        </h1>

        {wasRejected ? (
          <>
            <p className="text-[13px] text-[#4B5563] leading-relaxed mb-2">
              Unfortunately, your application was not approved at this time.
            </p>
            {state.kyc.rejectionReason && (
              <p className="text-[12px] text-[#6B7280] mb-4 italic">
                Reason: {state.kyc.rejectionReason}
              </p>
            )}
          </>
        ) : (
          <p className="text-[13px] text-[#4B5563] leading-relaxed mb-4">
            Thank you for completing your verification. Your application is currently being reviewed by our team. You will receive an email notification when your access is approved.
          </p>
        )}

        <div className="bg-[#F7F8FA] rounded-xl p-4 text-left mt-6 mb-6">
          <div className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] mb-2">
            Questions? Contact Adir Yonasi
          </div>
          <div className="space-y-1.5 text-[13px] text-[#0E3470]">
            <div className="flex items-center gap-2">
              <span className="text-[#9CA3AF]">📧</span>
              <a href="mailto:adir@reprime.com" className="hover:underline">adir@reprime.com</a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#9CA3AF]">📱</span>
              <a href="https://wa.me/972524824896" target="_blank" rel="noopener" className="hover:underline">
                WhatsApp: +972 52-482-4896
              </a>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#9CA3AF]">
          {wasRejected ? null : 'Expected review time: 24–48 hours'}
        </p>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
