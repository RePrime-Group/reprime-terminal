'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const locale = (params.locale as string) || 'en';

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale }),
      });

      if (!res.ok) {
        setError(await readApiError(res, t('forgotPasswordFailed')));
        setSubmitting(false);
        return;
      }

      setSent(true);
    } catch (err) {
      console.error('forgot password failed:', err);
      setError(friendlyFetchError(err, t('forgotPasswordFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#07090F' }}>
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="text-[#C9A54E] text-5xl font-bold tracking-tight">R</div>
          <h1 className="text-white text-xl font-semibold">{t('forgotPasswordTitle')}</h1>
          <p className="text-white/40 text-sm text-center px-4">{t('forgotPasswordSubtitle')}</p>
        </div>

        <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C9A54E]/10">
                <svg className="h-6 w-6 text-[#C9A54E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-white text-lg font-semibold">{t('checkYourInbox')}</h2>
              <p className="text-white/60 text-sm">{t('resetLinkSent')}</p>
              <a
                href={`/${locale}/login`}
                className="mt-4 text-[13px] text-[#BC9C45] hover:text-[#D4B96A] font-medium transition-colors"
              >
                ← {t('backToSignIn')}
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-white/50 text-xs font-medium uppercase tracking-wider">
                  {t('email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder={t('email')}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#C9A54E]/40 transition-colors"
                />
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
                {submitting ? t('sendingResetLink') : t('sendResetLink')}
              </button>

              <div className="text-center">
                <a
                  href={`/${locale}/login`}
                  className="text-[13px] text-[#BC9C45] hover:text-[#D4B96A] font-medium transition-colors"
                >
                  ← {t('backToSignIn')}
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
