'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

type ValidationResult =
  | { valid: true; email: string; role: string }
  | { valid: false; reason: 'expired' | 'used' | 'not_found' };

export default function InviteRegistrationPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const token = params.token as string;

  const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
    expired: {
      title: t('expiredToken'),
      description: t('expiredToken'),
    },
    used: {
      title: t('usedToken'),
      description: t('usedToken'),
    },
    not_found: {
      title: t('invalidToken'),
      description: t('invalidToken'),
    },
  };

  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch('/api/invite/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data: ValidationResult = await res.json();
        setValidation(data);
      } catch {
        setValidation({ valid: false, reason: 'not_found' });
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!validation || !validation.valid) return;

    setSubmitting(true);

    try {
      const supabase = createClient();

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: validation.email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setSubmitting(false);
        return;
      }

      const userId = authData.user?.id;

      if (!userId) {
        setError('Account creation failed. Please try again.');
        setSubmitting(false);
        return;
      }

      // Use server API to create profile (bypasses RLS + auto-confirms email)
      const profileRes = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: validation.email,
          fullName: fullName.trim(),
          role: validation.role,
          companyName: companyName.trim() || null,
          token,
        }),
      });

      if (!profileRes.ok) {
        const errData = await profileRes.json();
        setError(errData.error || 'Failed to create profile');
        setSubmitting(false);
        return;
      }

      // Sign in immediately (profile API auto-confirmed the email)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: validation.email,
        password,
      });

      if (signInError) {
        // If sign-in fails, send to login page with success message
        window.location.href = `/${locale}/login`;
        return;
      }

      // Redirect: employees to admin, investors to welcome page
      if (validation.role === 'employee') {
        window.location.href = `/${locale}/admin`;
      } else {
        window.location.href = `/${locale}/welcome`;
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#07090F' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="text-[#C9A54E] text-4xl font-bold">R</div>
          <div className="text-white/40 text-sm">{t('validatingInvitation')}</div>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!validation || !validation.valid) {
    const reason = !validation || !validation.valid ? (validation as { valid: false; reason: string })?.reason || 'not_found' : 'not_found';
    const msg = ERROR_MESSAGES[reason] || ERROR_MESSAGES.not_found;

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
            <h1 className="text-xl font-semibold text-white mb-2">{msg.title}</h1>
            <p className="text-white/50 text-sm mb-6">{msg.description}</p>
            <p className="text-white/30 text-xs">Contact RePrime for a new invitation.</p>
          </div>
        </div>
      </div>
    );
  }

  // Valid token - registration form
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#07090F' }}>
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="text-[#C9A54E] text-5xl font-bold tracking-tight">R</div>
          <h1 className="text-white text-xl font-semibold">{t('createYourAccount')}</h1>
          <p className="text-white/40 text-sm">{t('completeRegistration')}</p>
        </div>

        <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email (read-only) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/50 text-xs font-medium uppercase tracking-wider">{t('email')}</label>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white/40 text-sm">
                {validation.email}
              </div>
            </div>

            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fullName" className="text-white/50 text-xs font-medium uppercase tracking-wider">
                {t('fullName')} <span className="text-[#C9A54E]">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder={t('enterFullName')}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#C9A54E]/40 transition-colors"
              />
            </div>

            {/* Company Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="companyName" className="text-white/50 text-xs font-medium uppercase tracking-wider">
                {t('companyNameOptional')}
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t('enterCompanyName')}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#C9A54E]/40 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-white/50 text-xs font-medium uppercase tracking-wider">
                {t('password')} <span className="text-[#C9A54E]">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder={t('minimumChars')}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#C9A54E]/40 transition-colors"
              />
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-white/50 text-xs font-medium uppercase tracking-wider">
                {t('confirmPassword')} <span className="text-[#C9A54E]">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder={t('reenterPassword')}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-[#C9A54E]/40 transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-lg bg-[#C9A54E] py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('creatingAccount') : t('createAccount')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
