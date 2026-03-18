'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface LoginCardProps {
  locale: string;
}

export default function LoginCard({ locale }: LoginCardProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();

      // DEBUG: Verify env vars are loaded
      console.log('[LOGIN DEBUG] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // DEBUG: Log full auth result
      console.log('[LOGIN DEBUG] Auth error:', JSON.stringify(authError));
      console.log('[LOGIN DEBUG] Auth data session exists:', !!authData?.session);
      console.log('[LOGIN DEBUG] Auth data user id:', authData?.user?.id);

      if (authError) {
        setError(`Sign in failed: ${authError.message}`);
        setLoading(false);
        return;
      }

      if (!authData?.session) {
        console.log('[LOGIN DEBUG] No session returned — email may not be confirmed');
        setError('Account not confirmed. Check your email or confirm the account in Supabase dashboard.');
        setLoading(false);
        return;
      }

      const { data: user, error: userError } = await supabase
        .from('terminal_users')
        .select('role')
        .single();

      // DEBUG: Log terminal_users query result
      console.log('[LOGIN DEBUG] terminal_users data:', JSON.stringify(user));
      console.log('[LOGIN DEBUG] terminal_users error:', JSON.stringify(userError));

      if (userError || !user) {
        setError(`Profile not found. Make sure your account exists in terminal_users. Error: ${userError?.message || 'No row returned'}`);
        setLoading(false);
        return;
      }

      console.log('[LOGIN DEBUG] Redirecting, role:', user.role);

      // Use window.location.href to force a full page reload so the
      // Supabase auth cookie is available when middleware runs.
      if (user.role === 'investor') {
        window.location.href = `/${locale}/portal`;
      } else {
        window.location.href = `/${locale}/admin`;
      }
    } catch (err) {
      console.error('[LOGIN DEBUG] Unexpected error:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white/[0.02] border border-white/[0.08] backdrop-blur-[40px] rounded-2xl p-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)]">
      {/* Logo */}
      <div className="w-14 h-14 bg-gradient-to-br from-rp-gold to-rp-gold-soft rounded-xl flex items-center justify-center mx-auto">
        <span className="text-2xl font-extrabold text-white font-[family-name:var(--font-bodoni)]">
          R
        </span>
      </div>

      {/* Brand name */}
      <h1 className="text-[28px] font-bold text-white tracking-[0.15em] text-center mt-4">
        REPRIME
      </h1>
      <p className="text-xs font-[family-name:var(--font-bodoni)] italic text-rp-gold text-center mt-1">
        Terminal
      </p>

      {/* Form */}
      <form onSubmit={handleLogin} className="mt-8 space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          required
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:border-rp-gold/50 focus:outline-none transition-colors w-full"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3.5 text-white text-sm placeholder:text-white/30 focus:border-rp-gold/50 focus:outline-none transition-colors w-full"
        />

        {error && (
          <p className="text-rp-red text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white font-semibold rounded-lg text-sm hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Footer */}
      <p className="text-[11px] text-white/20 text-center mt-8">
        Membership by invitation only
      </p>
    </div>
  );
}
