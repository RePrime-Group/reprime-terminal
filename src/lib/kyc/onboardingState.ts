import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAuthUser } from '@/lib/supabase/currentUser';

export interface OnboardingState {
  hasBlanketNDA: boolean;
  kyc: {
    completedAt: string | null;
    approved: boolean;
    rejectedAt: string | null;
    rejectionReason: string | null;
    /** True if the user clicked "Save & Continue Later" — kyc_data exists but completedAt is null. */
    isPartial: boolean;
  } | null;
}

/**
 * Resolves what onboarding stage the current investor is at. Cached per
 * request, so the portal layout gate and any /onboarding/* page can call
 * this without duplicating queries.
 *
 * Returns null if no auth user.
 */
export const getOnboardingState = cache(async (): Promise<OnboardingState | null> => {
  const user = await getCurrentAuthUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: ndaRows }, { data: kyc }] = await Promise.all([
    supabase
      .from('terminal_nda_signatures')
      .select('id')
      .eq('user_id', user.id)
      .eq('nda_type', 'blanket')
      .limit(1),
    supabase
      .from('terminal_user_kyc')
      .select('completed_at, approved, rejected_at, rejection_reason, data')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  return {
    hasBlanketNDA: (ndaRows?.length ?? 0) > 0,
    kyc: kyc
      ? {
          completedAt: kyc.completed_at,
          approved: kyc.approved,
          rejectedAt: kyc.rejected_at,
          rejectionReason: kyc.rejection_reason,
          isPartial: !kyc.completed_at && !!kyc.data,
        }
      : null,
  };
});

/**
 * Where should this investor be sent right now? Returns null if they are
 * fully onboarded and may proceed to their home page.
 *
 * KYC was removed as a Terminal access requirement (per client direction).
 * The DB table and grandfathered records are preserved, but the gate now
 * only enforces the blanket NDA signature.
 */
export function nextOnboardingPath(state: OnboardingState, locale: string): string | null {
  if (!state.hasBlanketNDA) return `/${locale}/onboarding/nda`;
  return null;
}
