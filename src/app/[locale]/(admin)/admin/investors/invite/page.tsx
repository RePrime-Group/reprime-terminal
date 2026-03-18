'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type InviteRole = 'investor' | 'employee';

interface InviteResult {
  token: string;
}

export default function InviteInvestorPage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('investor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteLink = result
    ? `${window.location.origin}/${locale}/invite/${result.token}`
    : '';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be logged in to send invitations.');
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('terminal_invite_tokens')
      .insert({
        email,
        role,
        invited_by: user.id,
      })
      .select('token')
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setResult({ token: data.token });
    setLoading(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/${locale}/admin/investors`)}
          className="p-2 rounded-lg text-rp-gray-500 hover:bg-rp-gray-100 transition-colors"
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 15l-5-5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-[24px] font-bold text-rp-navy">Invite Investor</h1>
      </div>

      {/* Form / Success */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 max-w-lg">
        {result ? (
          <div className="text-center py-4">
            {/* Success icon */}
            <div className="mx-auto w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 14.5l4 4 8-9" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-rp-navy mb-1">Invitation Created</h2>
            <p className="text-sm text-rp-gray-500 mb-5">
              Share the link below with the investor.
            </p>

            {/* Invite link */}
            <div className="bg-rp-page-bg border border-rp-gray-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-rp-gray-500 mb-1 font-medium">Invite Link</p>
              <p className="text-sm text-rp-navy break-all font-mono">{inviteLink}</p>
            </div>

            <Button variant="gold" onClick={handleCopy} className="w-full mb-4">
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>

            <p className="text-xs text-rp-gray-400">
              Note: Send this link to the investor. It expires in 7 days.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Email"
              type="email"
              required
              placeholder="investor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div>
              <label
                htmlFor="role-select"
                className="block text-[13px] font-medium text-rp-gray-700 mb-1.5"
              >
                Role
              </label>
              <select
                id="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as InviteRole)}
                className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors bg-white"
              >
                <option value="investor">Investor</option>
                <option value="employee">Employee</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" variant="gold" loading={loading}>
              Send Invitation
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
