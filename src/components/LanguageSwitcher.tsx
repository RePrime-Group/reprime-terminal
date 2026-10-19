'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

// Each language is labelled in its own script so a user stuck in the other
// language can still recognise their option.
const LABELS: Record<string, { short: string; full: string }> = {
  en: { short: 'EN', full: 'English' },
  he: { short: 'עב', full: 'עברית' },
};

// Remember the choice so unprefixed URLs (/, /login) resolve to it — same
// cookie next-intl's middleware reads for locale detection.
function rememberLocale(next: string) {
  document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
}

// A pick made while signed out (login page) can't be saved to the account
// yet. Park it for this tab; LoginCard saves it right after sign-in. Kept
// separate from NEXT_LOCALE, which the middleware also rewrites from URLs.
const PICKED_KEY = 'rp_locale_picked';

function markPickedLocale(next: string) {
  try {
    sessionStorage.setItem(PICKED_KEY, next);
  } catch {
    // Storage blocked — the URL/cookie still carry the choice for this visit.
  }
}

/** Returns (and clears) a language explicitly picked before sign-in, if any. */
export function takePickedLocale(): string | null {
  try {
    const picked = sessionStorage.getItem(PICKED_KEY);
    sessionStorage.removeItem(PICKED_KEY);
    return picked && (routing.locales as readonly string[]).includes(picked) ? picked : null;
  } catch {
    return null;
  }
}

interface LanguageSwitcherProps {
  /** dark = portal navbar / auth pages, light = onboarding header. */
  variant?: 'dark' | 'light';
  /** short = "EN | עב" (tight headers), full = "English | עברית". */
  labels?: 'short' | 'full';
}

export default function LanguageSwitcher({ variant = 'dark', labels = 'short' }: LanguageSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const tc = useTranslations('common');
  const [switching, setSwitching] = useState(false);

  const switchTo = async (next: string) => {
    if (switching) return;
    setSwitching(true);
    // Signed in: save it on the account. src/proxy.ts reads it from the JWT
    // and keeps the user in this language on every device and emailed link,
    // so refresh the session to mint a token that carries the new value.
    // Clicking the already-active language still saves it if the account
    // holds something else (or nothing).
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (data.session.user.user_metadata?.locale !== next) {
          const { error } = await supabase.auth.updateUser({ data: { locale: next } });
          if (error) throw error;
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
        }
      } else {
        markPickedLocale(next);
      }
    } catch (err) {
      // Don't navigate: the proxy would bounce a stale token straight back.
      console.error('saving language preference failed:', err);
      setSwitching(false);
      return;
    }
    if (next === locale) {
      setSwitching(false);
      return;
    }
    rememberLocale(next);
    // Full navigation rather than a client transition so <html lang/dir> and
    // all server-rendered copy flip together.
    window.location.assign(`/${next}${pathname === '/' ? '' : pathname}${window.location.search}${window.location.hash}`);
  };

  const wrapper =
    variant === 'light'
      ? 'border-[#EEF0F4] bg-white'
      : 'border-white/[0.08] bg-white/[0.06]';
  const active =
    variant === 'light'
      ? 'bg-[#0E3470] text-white'
      : 'bg-[#BC9C45] text-[#07090F]';
  const inactive =
    variant === 'light'
      ? 'text-[#6B7280] hover:text-[#0E3470]'
      : 'text-white/60 hover:text-white';

  return (
    <div
      role="group"
      aria-label={tc('language')}
      dir="ltr"
      className={`inline-flex items-center gap-0.5 rounded-full border p-0.5 ${wrapper}`}
    >
      {routing.locales.map((l) => {
        const isActive = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={isActive}
            title={LABELS[l].full}
            onClick={() => switchTo(l)}
            disabled={switching}
            className={`min-w-[34px] rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none transition-colors disabled:opacity-60 ${
              isActive ? active : inactive
            }`}
          >
            {labels === 'full' ? LABELS[l].full : LABELS[l].short}
          </button>
        );
      })}
    </div>
  );
}
