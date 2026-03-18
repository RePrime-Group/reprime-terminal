'use client';

import { useState } from 'react';

interface LoginCardProps {
  locale: string;
}

export default function LoginCard({ locale }: LoginCardProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  function addLog(msg: string) {
    console.log('[LOGIN]', msg);
    setDebugLog((prev) => [...prev, msg]);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDebugLog([]);

    addLog('handleLogin fired');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    addLog(`SUPABASE URL: ${url?.substring(0, 40) || 'UNDEFINED'}`);
    addLog(`ANON KEY: ${key ? key.substring(0, 20) + '...' : 'UNDEFINED'}`);

    if (!url || !key) {
      setError('Supabase env vars are missing. Check Vercel environment variables.');
      setLoading(false);
      return;
    }

    try {
      // Import createBrowserClient dynamically to catch import errors
      addLog('Importing @supabase/ssr...');
      const { createBrowserClient } = await import('@supabase/ssr');
      addLog('Import OK, creating client...');

      const supabase = createBrowserClient(url, key);
      addLog('Client created, calling signInWithPassword...');

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      addLog(`AUTH DATA: ${JSON.stringify(data)}`);
      addLog(`AUTH ERROR: ${JSON.stringify(authError)}`);

      if (authError) {
        setError(`Sign in failed: ${authError.message}`);
        setLoading(false);
        return;
      }

      if (!data?.session) {
        addLog('No error but no session either — email likely not confirmed');
        setError('No session returned. The email may not be confirmed in Supabase. Go to Supabase Dashboard → Authentication → Users and confirm the email.');
        setLoading(false);
        return;
      }

      addLog(`Session OK, user id: ${data.session.user.id}`);
      addLog('Querying terminal_users...');

      const { data: userData, error: userError } = await supabase
        .from('terminal_users')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      addLog(`USER ROLE: ${JSON.stringify(userData)} ERROR: ${JSON.stringify(userError)}`);

      if (userError || !userData) {
        setError(`Profile not found in terminal_users for id ${data.session.user.id}. Run the seed migration (003). Error: ${userError?.message || 'no row'}`);
        setLoading(false);
        return;
      }

      addLog(`Redirecting as ${userData.role}...`);

      if (userData.role === 'investor') {
        window.location.href = `/${locale}/portal`;
      } else {
        window.location.href = `/${locale}/admin`;
      }
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      addLog(`CAUGHT ERROR: ${msg}`);
      console.error('[LOGIN] Full error:', err);
      setError(`Error: ${msg}`);
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
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm break-all">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white font-semibold rounded-lg text-sm hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Debug log — visible on page */}
      {debugLog.length > 0 && (
        <div className="mt-4 bg-black/40 border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto">
          <p className="text-white/40 text-[10px] font-mono mb-1">DEBUG LOG:</p>
          {debugLog.map((log, i) => (
            <p key={i} className="text-green-400/80 text-[10px] font-mono break-all leading-relaxed">
              {log}
            </p>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-[11px] text-white/20 text-center mt-8">
        Membership by invitation only
      </p>
    </div>
  );
}
