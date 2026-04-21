'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type InviteRole = 'investor' | 'employee';

interface InviteResult {
  token: string;
  expiresAt: string;
}

export default function InviteInvestorPage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const router = useRouter();
  const t = useTranslations('admin.investors');
  const tc = useTranslations('common');
  const ta = useTranslations('auth');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('investor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const inviteLink = result
    ? `${window.location.origin}/${locale}/invite/${result.token}`
    : '';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const createRes = await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
    });

    const createBody = await createRes.json().catch(() => ({}));

    if (!createRes.ok) {
      setError(createBody?.error || ta('unexpectedError'));
      setLoading(false);
      return;
    }

    const token = createBody.token as string;
    const expiresAt = createBody.expires_at as string;
    const inviteUrl = `${window.location.origin}/${locale}/invite/${token}`;

    setResult({ token, expiresAt });

    // Send invitation email automatically
    try {
      const res = await fetch('/api/email/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, inviteUrl, inviteCode: token, expiresAt }),
      });
      if (res.ok) {
        setEmailSent(true);
      } else {
        const body = await res.json();
        setEmailError(body.error || 'Failed to send email');
      }
    } catch {
      setEmailError('Failed to send invitation email');
    }

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
        <h1 className="text-[24px] font-bold text-rp-navy">{t('invite')}</h1>
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
            <h2 className="text-lg font-semibold text-rp-navy mb-1">{t('invitationCreated')}</h2>
            {emailSent ? (
              <p className="text-sm text-green-600 mb-5">
                {t('emailSentTo')} <strong>{email}</strong>
              </p>
            ) : emailError ? (
              <p className="text-sm text-amber-600 mb-5">
                {t('emailNotSent')}: {emailError}
              </p>
            ) : (
              <p className="text-sm text-rp-gray-500 mb-5">
                {t('sendingEmail')}
              </p>
            )}

            {/* Invite link */}
            <div className="bg-rp-page-bg border border-rp-gray-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-rp-gray-500 mb-1 font-medium">{t('inviteLink')}</p>
              <p className="text-sm text-rp-navy break-all font-mono">{inviteLink}</p>
            </div>

            <Button variant="gold" onClick={handleCopy} className="w-full mb-4">
              {copied ? t('copied') : t('copyLink')}
            </Button>

            <p className="text-xs text-rp-gray-400 mb-5">
              {t('expiresOn')}{' '}
              {new Date(result.expiresAt).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
            </p>

            <button
              onClick={() => {
                setResult(null);
                setEmail('');
                setRole('investor');
                setEmailSent(false);
                setEmailError(null);
                setCopied(false);
              }}
              className="text-sm font-medium text-rp-gold hover:text-rp-gold/80 transition-colors"
            >
              {t('inviteAnother')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label={t('email')}
              type="email"
              required
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div>
              <label
                htmlFor="role-select"
                className="block text-[13px] font-medium text-rp-gray-700 mb-1.5"
              >
                {t('role')}
              </label>
              <select
                id="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as InviteRole)}
                className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors bg-white"
              >
                <option value="investor">{t('investor')}</option>
                <option value="employee">{t('employee')}</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" variant="gold" loading={loading}>
              {t('sendInvite')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
