'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@supabase/ssr';

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
      setError('Supabase configuration missing.');
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
        setError(`Sign in failed: ${authError.message}`);
        setLoading(false);
        return;
      }

      if (!data?.session) {
        setError('Email not confirmed. Confirm the account in Supabase Dashboard → Authentication → Users.');
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('terminal_users')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      if (userError || !userData) {
        setError(`Profile not found. Run the seed migration for user ${data.session.user.id}.`);
        setLoading(false);
        return;
      }

      const loc = locale || 'en';
      redirectTo = userData.role === 'investor' ? `/${loc}/portal` : `/${loc}/admin`;
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
      return;
    }

    // Redirect OUTSIDE try/catch — nothing can swallow this
    if (redirectTo) {
      window.location.replace(redirectTo);
    }
  }

  return (
    <div className="w-full max-w-md bg-white/[0.02] border border-white/[0.08] backdrop-blur-[40px] rounded-2xl p-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[#BC9C45]/20 hover:shadow-[0_0_30px_rgba(188,156,69,0.08)]">
      <div className="w-14 h-14 bg-gradient-to-br from-rp-gold to-rp-gold-soft rounded-xl flex items-center justify-center mx-auto animate-glow">
        <span className="text-2xl font-extrabold text-white font-[family-name:var(--font-playfair)]">
          R
        </span>
      </div>

      <h1 className="text-[28px] font-bold text-white tracking-[4px] text-center mt-4">
        REPRIME
      </h1>
      <p className="text-xs font-[family-name:var(--font-playfair)] italic text-rp-gold text-center mt-1">
        Terminal
      </p>

      {/* Gold line separator */}
      <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#BC9C45]/30 to-transparent mx-auto my-6" />

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('email')}
          required
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:border-rp-gold/50 focus:outline-none transition-colors w-full"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('password')}
          required
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:border-rp-gold/50 focus:outline-none transition-colors w-full"
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm break-all">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-white font-semibold rounded-lg text-sm hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(188,156,69,0.3)] transition-all duration-200 disabled:opacity-50"
        >
          {loading ? `${t('signIn')}...` : t('signIn')}
        </button>
      </form>

      {/* Invite code + Apply */}
      <div className="mt-8 pt-6 border-t border-white/[0.06]">
        <p className="text-[11px] text-white/30 text-center mb-3">Have an invitation code?</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter code (e.g. RPT-2026-AXYZ)"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-[#BC9C45]/40 transition-colors"
          />
          <button
            onClick={handleInviteCode}
            className="px-4 py-2.5 rounded-lg border border-[#BC9C45]/30 text-[#BC9C45] text-[12px] font-semibold hover:bg-[#BC9C45]/10 transition-colors"
          >
            Go
          </button>
        </div>
        <div className="text-center mt-4">
          <a
            href={`/${locale}/join`}
            className="text-[12px] text-[#BC9C45] hover:text-[#D4B96A] font-medium transition-colors"
          >
            Apply for Membership →
          </a>
        </div>
      </div>
    </div>
  );
}
