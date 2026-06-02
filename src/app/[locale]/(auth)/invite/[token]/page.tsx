'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { friendlyAuthError, friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';
import RePrimeLogo from '@/components/RePrimeLogo';
import { ESIGN_DISCLOSURE_TITLE, ESIGN_DISCLOSURE_BODY } from '@/lib/legal/esign-disclosure';

type ValidationResult =
  | { valid: true; email: string; role: string; parent_investor_id?: string | null; parent_name?: string | null }
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
  const [validationNetworkError, setValidationNetworkError] = useState(false);

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [eSignConsent, setESignConsent] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [tosConsent, setTosConsent] = useState(false);

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
      } catch (err) {
        console.error('invite token validation failed:', err);
        // Surface as a network error rather than pretending the token is invalid.
        setValidationNetworkError(true);
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
      setError(t('fullNameRequired'));
      return;
    }

    if (password.length < 8) {
      setError(t('passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    if (!eSignConsent) {
      setError(t('eSignConsentRequired'));
      return;
    }

    if (!tosConsent) {
      setError(t('tosPrivacyRequired'));
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
        setError(friendlyAuthError(signUpError.message, t('accountCreationFailed')));
        setSubmitting(false);
        return;
      }

      const userId = authData.user?.id;

      if (!userId) {
        setError(t('accountCreationFailed'));
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
        setError(await readApiError(profileRes, t('failedToCreateProfile')));
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

      // Redirect: employees to admin, investors (primary or team members)
      // straight into the NDA/KYC onboarding flow. The portal layout gate
      // also enforces this, but routing here directly skips a needless hop.
      // The /welcome (founding member) page is no longer auto-shown — the
      // existing OnboardingOverlay walkthrough fires once they reach /portal.
      if (validation.role === 'employee') {
        window.location.href = `/${locale}/admin`;
      } else {
        window.location.href = `/${locale}/onboarding/nda`;
      }
    } catch (err) {
      console.error('invite submit failed:', err);
      setError(friendlyFetchError(err, t('unexpectedError')));
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-start justify-center pt-24" style={{ backgroundColor: '#07090F' }}>
        <div className="flex flex-col items-center gap-5">
          <RePrimeLogo width={180} />
          <div className="text-white/40 text-sm">{t('validatingInvitation')}</div>
        </div>
      </div>
    );
  }

  // Network failure while validating — distinct from an invalid token so we
  // don't tell the investor their link is bad when it's actually their connection.
  if (validationNetworkError) {
    return (
      <div className="min-h-screen flex items-start justify-center px-4 pt-24 pb-12" style={{ backgroundColor: '#07090F' }}>
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          <RePrimeLogo width={220} />
          <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur p-8 text-center">
            <h1 className="text-xl font-semibold text-white mb-2">Connection problem</h1>
            <p className="text-white/50 text-sm mb-6">We couldn&rsquo;t reach our servers to check your invitation. Please check your internet connection and try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[#C9A54E] px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!validation || !validation.valid) {
    const reason = !validation || !validation.valid ? (validation as { valid: false; reason: string })?.reason || 'not_found' : 'not_found';
    const msg = ERROR_MESSAGES[reason] || ERROR_MESSAGES.not_found;

    return (
      <div className="min-h-screen flex items-start justify-center px-4 pt-24 pb-12" style={{ backgroundColor: '#07090F' }}>
        <div className="w-full max-w-md flex flex-col items-center gap-8">
          <RePrimeLogo width={220} />

          <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">{msg.title}</h1>
            <p className="text-white/50 text-sm mb-6">{msg.description}</p>
            <p className="text-white/30 text-xs">{t('contactForNewInvite')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Valid token - registration form
  return (
    <div className="min-h-screen flex items-start justify-center px-4 pt-16 pb-12" style={{ backgroundColor: '#07090F' }}>
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <RePrimeLogo width={240} />
          <h1 className="text-white text-xl font-semibold">{t('createYourAccount')}</h1>
          {validation.parent_investor_id && validation.parent_name ? (
            <p className="text-white/60 text-sm text-center px-4">
              <span className="text-[#C9A54E] font-medium">{validation.parent_name}</span>
              {' '}invited you to join their RePrime team.
            </p>
          ) : (
            <p className="text-white/40 text-sm">{t('completeRegistration')}</p>
          )}
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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
              <PasswordStrength password={password} t={t} />
            </div>

            {/* Confirm Password */}
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

            {/* E-Sign Act consent */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={eSignConsent}
                onClick={() => setESignConsent((v) => !v)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  eSignConsent ? 'border-[#C9A54E] bg-[#C9A54E]' : 'border-white/[0.15] bg-white/[0.03]'
                }`}
              >
                {eSignConsent && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <p className="text-white/60 text-sm leading-relaxed">
                {t('eSignConsent')}{' '}
                <button
                  type="button"
                  onClick={() => setShowDisclosure(true)}
                  className="text-[#C9A54E] underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  {t('eSignViewDisclosure')}
                </button>
              </p>
            </div>

            {/* Terms of Service & Privacy Policy consent */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={tosConsent}
                onClick={() => setTosConsent((v) => !v)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  tosConsent ? 'border-[#C9A54E] bg-[#C9A54E]' : 'border-white/[0.15] bg-white/[0.03]'
                }`}
              >
                {tosConsent && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <p className="text-white/60 text-sm leading-relaxed">
                {t.rich('tosPrivacyConsent', {
                  terms: (chunks) => (
                    <a
                      href={`/${locale}/legal/terms`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C9A54E] underline underline-offset-2 hover:opacity-80 transition-opacity"
                    >
                      {chunks}
                    </a>
                  ),
                  privacy: (chunks) => (
                    <a
                      href={`/${locale}/legal/privacy`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C9A54E] underline underline-offset-2 hover:opacity-80 transition-opacity"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </p>
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

      {/* E-Sign disclosure modal — dark-themed to match this auth screen */}
      {showDisclosure && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
          onClick={() => setShowDisclosure(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-white/[0.08] bg-[#0B0E15] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-4">
              <h2 className="text-base font-semibold text-white">{ESIGN_DISCLOSURE_TITLE}</h2>
              <button
                type="button"
                onClick={() => setShowDisclosure(false)}
                aria-label={t('eSignDisclosureClose')}
                className="-mr-1 shrink-0 p-1 text-white/40 hover:text-white/80 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-white/60">
              {ESIGN_DISCLOSURE_BODY.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            <div className="border-t border-white/[0.06] px-6 py-4">
              <button
                type="button"
                onClick={() => setShowDisclosure(false)}
                className="w-full rounded-lg bg-white/[0.06] py-2.5 text-sm font-medium text-white hover:bg-white/[0.1] transition-colors"
              >
                {t('eSignDisclosureClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordStrength({ password, t }: { password: string; t: ReturnType<typeof useTranslations> }) {
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const hasLongLength = password.length >= 12;

  // Score 0–4 mapped to Weak/Fair/Good/Strong. Empty password = 0 segments lit.
  let score = 0;
  if (hasLength) score++;
  if (hasLongLength) score++;
  if (hasUpper && hasLower) score++;
  if (hasNumber) score++;
  if (hasSymbol) score++;
  score = Math.min(score, 4);
  if (password.length === 0) score = 0;
  else if (score < 1) score = 1;

  const levels = [
    { color: '#F87171', label: t('passwordStrengthWeak') },
    { color: '#FBBF24', label: t('passwordStrengthFair') },
    { color: '#D4A843', label: t('passwordStrengthGood') },
    { color: '#34D399', label: t('passwordStrengthStrong') },
  ];
  const activeIdx = Math.max(0, score - 1);
  const showLabel = password.length > 0;
  const current = levels[activeIdx];

  const rules: Array<{ ok: boolean; label: string }> = [
    { ok: hasLength, label: t('passwordRuleLength') },
    { ok: hasUpper, label: t('passwordRuleUppercase') },
    { ok: hasLower, label: t('passwordRuleLowercase') },
    { ok: hasNumber, label: t('passwordRuleNumber') },
  ];

  return (
    <div className="mt-2 flex flex-col gap-2.5">
      {/* Strength meter */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 flex items-center gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-colors"
              style={{
                backgroundColor: i < score ? current.color : 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>
        <span
          className="text-[10px] font-semibold uppercase tracking-[1.5px] w-14 text-right transition-colors"
          style={{ color: showLabel ? current.color : 'rgba(255,255,255,0.25)' }}
        >
          {showLabel ? current.label : ' '}
        </span>
      </div>

      {/* Rules checklist */}
      <ul className="flex flex-col gap-1">
        {rules.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            {r.ok ? (
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <span className="w-3 h-3 shrink-0 flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-white/30" />
              </span>
            )}
            <span
              className="text-[11px] transition-colors"
              style={{ color: r.ok ? '#34D399' : 'rgba(255,255,255,0.45)' }}
            >
              {r.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
