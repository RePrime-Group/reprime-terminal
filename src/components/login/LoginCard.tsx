'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@supabase/ssr';
import { friendlyAuthError, friendlyFetchError } from '@/lib/utils/friendly-error';
import RePrimeLogo from '@/components/RePrimeLogo';

interface LoginCardProps {
  locale: string;
}

function safeRedirectForRole(raw: string | null, role: string): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  if (/^\/[^/]*:/.test(raw)) return null;
  const bare = raw.replace(/^\/(en|he)(?=\/|$)/, '') || '/';
  if (role === 'investor' && bare.startsWith('/portal')) return raw;
  if (role !== 'investor' && bare.startsWith('/admin')) return raw;
  return null;
}

export default function LoginCard({ locale }: LoginCardProps) {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  // Dev convenience: prefill credentials so we don't retype on every reload.
  // Stripped automatically in production builds.
  const DEV_EMAIL = process.env.NODE_ENV !== 'production' ? 'aliak30062@gmail.com' : '';
  const DEV_PASSWORD = process.env.NODE_ENV !== 'production' ? 'test1234' : '';
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleInviteCode = () => {
    if (!inviteCode.trim()) return;
    window.location.href = `/${locale}/invite/${inviteCode.trim()}`;
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setError('Sign-in is temporarily unavailable. Please try again shortly.');
      setLoading(false);
      return;
    }

    let redirectTo: string | null = null;

    try {
      const supabase = createBrowserClient(url, key);

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(friendlyAuthError(authError.message, 'We couldn\u2019t sign you in. Please check your email and password and try again.'));
        setLoading(false);
        return;
      }

      if (!data?.session) {
        setError('Your email hasn\u2019t been confirmed yet. Please check your inbox for the confirmation link, or contact RePrime if you need help.');
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('terminal_users')
        .select('role, access_tier')
        .eq('id', data.session.user.id)
        .single();

      if (userError || !userData) {
        console.error('terminal_users lookup failed:', userError, data.session.user.id);
        setError('We couldn\u2019t find your profile. Please contact RePrime to finish setting up your account.');
        setLoading(false);
        return;
      }

      const loc = locale || 'en';
      const requested = safeRedirectForRole(searchParams.get('redirect'), userData.role);

      if (userData.role !== 'investor') {
        // Owners / employees \u2192 admin (or honored admin redirect).
        redirectTo = requested ?? `/${loc}/admin`;
      } else if (userData.access_tier === 'marketplace_only') {
        // Marketplace-only investors always land on the marketplace page \u2014
        // the proxy would bounce them back here from anywhere else anyway.
        redirectTo = `/${loc}/portal/marketplace`;
      } else {
        // Full investors land on the Dashboard by default. Honor only deep
        // links to a specific deal (share-links) so those keep working;
        // ignore generic tab redirects like /portal/marketplace or
        // /portal/portfolio so a stale ?redirect doesn't deflect us off the
        // dashboard.
        const isDealLink = !!requested && /\/portal\/deals\/[^/]+/.test(requested);
        redirectTo = isDealLink ? requested! : `/${loc}/portal`;
      }
    } catch (err) {
      console.error('login failed:', err);
      setError(friendlyFetchError(err, 'Something went wrong while signing in. Please try again.'));
      setLoading(false);
      return;
    }

    // Redirect OUTSIDE try/catch — nothing can swallow this
    if (redirectTo) {
      window.location.replace(redirectTo);
    }
  }

  return (
    <div
      className="w-full max-w-md border rounded-2xl p-8 transition-all duration-300"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.08)',
        WebkitBackdropFilter: 'blur(40px)',
        backdropFilter: 'blur(40px)',
        boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex flex-col items-center gap-2 mt-2">
        <RePrimeLogo width={280} />
        <span className="px-1.5 py-[2px] rounded bg-[#BC9C45] text-[#07090F] text-[8px] font-bold uppercase tracking-[1.5px] leading-none">
          Beta
        </span>
      </div>

      {/* Gold line separator */}
      <div
        className="w-12 h-px mx-auto my-6"
        style={{ background: 'linear-gradient(to right, transparent, rgba(188,156,69,0.3), transparent)' }}
      />

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('email')}
          required
          className="rounded-lg px-4 py-3.5 text-white text-sm focus:outline-none transition-colors w-full"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('password')}
            required
            className="rounded-lg px-4 py-3.5 pr-12 text-white text-sm focus:outline-none transition-colors w-full"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
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

        <div className="flex justify-end -mt-1">
          <a
            href={`/${locale}/forgot-password`}
            className="text-[12px] text-[#BC9C45] hover:text-[#D4B96A] font-medium transition-colors"
          >
            {t('forgotPassword')}
          </a>
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#F87171',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 text-white font-semibold rounded-lg text-sm hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
          style={{
            background: 'linear-gradient(to right, #BC9C45, #D4B96A)',
            boxShadow: '0 4px 14px rgba(188,156,69,0.25)',
          }}
        >
          {loading ? `${t('signIn')}...` : t('signIn')}
        </button>
      </form>

      {/* Invite code + Apply */}
      <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[11px] text-center mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('haveInvitationCode')}</p>
        <div className="flex gap-2 min-w-0">
          <input
            type="text"
            placeholder={t('enterCode')}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="flex-1 min-w-0 px-3.5 py-2.5 rounded-lg text-white text-[13px] focus:outline-none transition-colors"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
          <button
            onClick={handleInviteCode}
            className="px-4 py-2.5 rounded-lg text-[12px] font-semibold transition-colors shrink-0"
            style={{
              border: '1px solid rgba(188,156,69,0.3)',
              color: '#BC9C45',
              background: 'transparent',
            }}
          >
            {t('go')}
          </button>
        </div>
        <div className="text-center mt-4">
          <a
            href={`/${locale}/join`}
            className="text-[12px] text-[#BC9C45] hover:text-[#D4B96A] font-medium transition-colors"
          >
            {t('applyForMembership')} →
          </a>
        </div>
      </div>
    </div>
  );
}
