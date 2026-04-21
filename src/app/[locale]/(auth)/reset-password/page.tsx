'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError, friendlyFetchError } from '@/lib/utils/friendly-error';

type Status = 'loading' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params.locale as string) || 'en';

  const [status, setStatus] = useState<Status>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();

    // Our /api/auth/confirm route redirects here with ?error=expired|invalid
    // when server-side verifyOtp fails.
    if (searchParams.get('error')) {
      setStatus('invalid');
      return;
    }

    // Legacy/fallback: if the link was opened via Supabase's hosted verify URL
    // (e.g. from an older email), the error/session lands in the hash.
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash.includes('error=') || hash.includes('error_description=')) {
      setStatus('invalid');
      return;
    }

    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (data.session) {
        setStatus('ready');
        // Clean the tokens out of the URL so they aren't visible/shareable.
        if (typeof window !== 'undefined' && window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      } else {
        setStatus('invalid');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(friendlyAuthError(updateError.message, t('passwordResetFailed')));
        setSubmitting(false);
        return;
      }

      // Sign out of the recovery session so the user logs in fresh with the
      // new password — this is the clearest signal that the reset worked.
      await supabase.auth.signOut();
      setStatus('done');
    } catch (err) {
      console.error('password reset failed:', err);
      setError(friendlyFetchError(err, t('passwordResetFailed')));
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#07090F' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="text-[#C9A54E] text-4xl font-bold">R</div>
          <div className="text-white/40 text-sm">{t('validatingResetLink')}</div>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#07090F' }}>
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          <div className="text-[#C9A54E] text-5xl font-bold tracking-tight">R</div>
          <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">{t('resetLinkInvalidTitle')}</h1>
            <p className="text-white/50 text-sm mb-6">{t('resetLinkInvalidBody')}</p>
            <a
              href={`/${locale}/forgot-password`}
              className="inline-block rounded-lg bg-[#C9A54E] px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
            >
              {t('requestNewResetLink')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#07090F' }}>
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          <div className="text-[#C9A54E] text-5xl font-bold tracking-tight">R</div>
          <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#C9A54E]/10">
              <svg className="h-6 w-6 text-[#C9A54E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">{t('passwordResetSuccessTitle')}</h1>
            <p className="text-white/50 text-sm mb-6">{t('passwordResetSuccessBody')}</p>
            <a
              href={`/${locale}/login`}
              className="inline-block rounded-lg bg-[#C9A54E] px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
            >
              {t('signIn')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#07090F' }}>
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="text-[#C9A54E] text-5xl font-bold tracking-tight">R</div>
          <h1 className="text-white text-xl font-semibold">{t('resetPasswordTitle')}</h1>
          <p className="text-white/40 text-sm">{t('resetPasswordSubtitle')}</p>
        </div>

        <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-white/50 text-xs font-medium uppercase tracking-wider">
                {t('newPassword')} <span className="text-[#C9A54E]">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                  placeholder={t('minimumChars')}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 pr-12 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#C9A54E]/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-white/80 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-white/50 text-xs font-medium uppercase tracking-wider">
                {t('confirmPassword')} <span className="text-[#C9A54E]">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={t('reenterPassword')}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 pr-12 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#C9A54E]/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? t('hidePassword') : t('showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-white/80 transition-colors"
                >
                  {showConfirm ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-lg bg-[#C9A54E] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('updatingPassword') : t('updatePassword')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
