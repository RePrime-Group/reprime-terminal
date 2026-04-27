'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

export default function OnboardingSignOutButton({ locale }: { locale: string }) {
  const tc = useTranslations('common');
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace(`/${locale}/login`);
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      className="text-[12px] font-medium text-[#6B7280] hover:text-[#0E3470] transition-colors disabled:opacity-50"
    >
      {signingOut ? tc('signingOut') : tc('signOut')}
    </button>
  );
}
