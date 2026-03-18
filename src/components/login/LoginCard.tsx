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

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Invalid email or password');
      setLoading(false);
      return;
    }

    const { data: user } = await supabase
      .from('terminal_users')
      .select('role')
      .single();

    // Use window.location.href instead of router.push to force a full page
    // reload. This ensures the Supabase auth cookie is fully written to the
    // browser before the middleware runs on the next request.
    if (user?.role === 'investor') {
      window.location.href = `/${locale}/portal`;
    } else {
      window.location.href = `/${locale}/admin`;
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
