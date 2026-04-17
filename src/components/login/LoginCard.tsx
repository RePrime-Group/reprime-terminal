'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@supabase/ssr';
import { friendlyAuthError, friendlyFetchError } from '@/lib/utils/friendly-error';

interface LoginCardProps {
  locale: string;
}

export default function LoginCard({ locale }: LoginCardProps) {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      if (userError || !userData) {
        console.error('terminal_users lookup failed:', userError, data.session.user.id);
        setError('We couldn\u2019t find your profile. Please contact RePrime to finish setting up your account.');
        setLoading(false);
        return;
      }

      const loc = locale || 'en';
      redirectTo = userData.role === 'investor' ? `/${loc}/portal` : `/${loc}/admin`;
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
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto animate-glow"
        style={{ background: 'linear-gradient(135deg, #BC9C45 0%, #D4B96A 100%)' }}
      >
        <span className="text-2xl font-extrabold text-white font-[family-name:var(--font-playfair)]">
          R
        </span>
      </div>

      <h1 className="text-[28px] font-bold text-white tracking-[4px] text-center mt-4">
        REPRIME
      </h1>
      <div className="flex items-center justify-center gap-2 mt-1">
        <p className="text-xs font-[family-name:var(--font-playfair)] italic text-rp-gold">
          Terminal
        </p>
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
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('password')}
          required
          className="rounded-lg px-4 py-3.5 text-white text-sm focus:outline-none transition-colors w-full"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        />

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
