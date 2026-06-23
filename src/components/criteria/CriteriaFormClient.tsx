'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import RePrimeLogo from '@/components/RePrimeLogo';
import CrmMandateForm, {
  EMPTY_MANDATE,
  validateMandate,
  type MandateInput,
} from '@/components/admin/crm/CrmMandateForm';
import CriteriaIdentityFields, { type CriteriaIdentityValue } from './CriteriaIdentityFields';

export interface CriteriaFormInitialValue {
  token: string;
  identity: CriteriaIdentityValue;
  mandates: MandateInput[];
}

interface Props {
  locale: string;
  initial: CriteriaFormInitialValue;
}

interface SubmitOutcome {
  isRegistered: boolean;
  isLoggedIn: boolean;
  email: string;
  loginUrl: string;
  terminalUrl: string;
  joinUrl: string;
  whatsappUrl: string | null;
}

export default function CriteriaFormClient({ locale, initial }: Props) {
  const t = useTranslations('criteria');
  const router = useRouter();

  const [identity, setIdentity] = useState<CriteriaIdentityValue>(initial.identity);
  const [mandates, setMandates] = useState<MandateInput[]>(
    initial.mandates.length > 0 ? initial.mandates : [{ ...EMPTY_MANDATE }],
  );
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);

  const addMandate = () => setMandates((m) => [...m, { ...EMPTY_MANDATE }]);
  const removeMandate = (idx: number) => setMandates((m) => m.filter((_, i) => i !== idx));
  const updateMandate = (idx: number, next: MandateInput) =>
    setMandates((m) => m.map((x, i) => (i === idx ? next : x)));

  const handleSubmit = async () => {
    setError(null);

    if (!identity.first_name.trim() || !identity.last_name.trim()) {
      setError(t('errors.nameRequired'));
      return;
    }
    if (!identity.phone.trim()) {
      setError(t('errors.phoneRequired'));
      return;
    }
    if (!consent) {
      setError(t('errors.consentRequired'));
      return;
    }
    for (let i = 0; i < mandates.length; i++) {
      const v = validateMandate(mandates[i]);
      if (v) {
        setError(`${t('errors.mandatePrefix', { num: i + 1 })} ${v}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: initial.token,
          identity,
          mandates,
          consent_contact: true,
          locale,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body?.error === 'invalid_or_used_token') {
          router.push('/criteria?invalid=used');
          return;
        }
        setError(body?.message || t('errors.submitFailed'));
        setSubmitting(false);
        return;
      }
      // Success — flip to the thank-you screen with branched CTAs.
      setOutcome({
        isRegistered: !!body.isRegistered,
        isLoggedIn: !!body.isLoggedIn,
        email: body.email ?? identity.email,
        loginUrl: body.loginUrl,
        terminalUrl: body.terminalUrl,
        joinUrl: body.joinUrl,
        whatsappUrl: body.whatsappUrl ?? null,
      });
      setSubmitting(false);
    } catch {
      setError(t('errors.network'));
      setSubmitting(false);
    }
  };

  if (outcome) {
    return <CriteriaThankYou locale={locale} outcome={outcome} />;
  }

  return (
    <div className="min-h-screen rp-page-texture">
      <nav className="flex items-center justify-between px-5 md:px-10 py-4 md:py-6">
        <div className="flex items-center gap-2 min-w-0">
          <RePrimeLogo width={180} variant="navy" />
          <span className="px-1.5 py-[2px] rounded bg-rp-gold text-white text-[8px] font-bold uppercase tracking-[1.5px] leading-none">
            Beta
          </span>
        </div>
        <Link
          href="/login"
          locale={locale}
          className="shrink-0 px-3.5 md:px-5 py-2 border border-rp-gray-200 text-rp-navy text-[12px] font-medium rounded-lg hover:border-rp-gold/40 transition-colors"
        >
          {t('signIn')}
        </Link>
      </nav>

      {/* Hero */}
      <div className="max-w-[820px] mx-auto px-5 md:px-10 pt-2 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rp-gold-bg border border-rp-gold/20 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-rp-green" />
          <span className="text-[10px] font-medium tracking-[2px] text-rp-gold uppercase">{t('badge')}</span>
        </div>
        <h1 className="font-[family-name:var(--font-playfair)] text-[28px] sm:text-[34px] md:text-[42px] font-semibold text-rp-navy leading-[1.15] tracking-[-0.02em] mb-3">
          {t('hero')}
        </h1>
        <p className="text-[14px] md:text-[15px] text-rp-gray-500 max-w-[560px] mx-auto leading-relaxed">
          {t('subhero', { name: identity.first_name || identity.last_name || 'investor' })}
        </p>
      </div>

      <div className="max-w-[820px] mx-auto px-5 md:px-10 pb-12 flex flex-col gap-5">
        {/* Identity */}
        <FormSection title={t('sectionIdentity')}>
          <CriteriaIdentityFields value={identity} onChange={setIdentity} />
        </FormSection>

        {/* Mandates */}
        {mandates.map((m, idx) => (
          <FormSection
            key={idx}
            title={
              mandates.length === 1
                ? t('sectionTarget')
                : t('sectionTargetN', { num: idx + 1 })
            }
            onRemove={mandates.length > 1 ? () => removeMandate(idx) : undefined}
          >
            <CrmMandateForm
              value={m}
              onChange={(next) => updateMandate(idx, next)}
              theme="light"
              showLabelField={true}
            />
          </FormSection>
        ))}

        <button
          onClick={addMandate}
          className="self-start px-4 py-2 rounded-lg border border-dashed border-rp-gold/50 text-rp-gold text-sm font-semibold hover:bg-rp-gold-bg"
        >
          + {t('addTarget')}
        </button>

        {/* Consent + submit */}
        <FormSection title={t('sectionConsent')}>
          <label className="flex items-start gap-3 text-sm text-rp-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 accent-rp-gold"
            />
            <span>{t('consentText')}</span>
          </label>

          {error && (
            <p className="mt-4 text-sm text-rp-red bg-rp-red-light border border-rp-red/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-5 w-full py-4 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-[15px] font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-[0_6px_24px_rgba(188,156,69,0.3)]"
          >
            {submitting ? t('submitting') : t('submit')}
          </button>
          <p className="text-[11px] text-rp-gray-400 text-center mt-3">{t('singleUseHint')}</p>
        </FormSection>
      </div>
    </div>
  );
}

function FormSection({
  title,
  onRemove,
  children,
}: {
  title: string;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-rp-gray-200 rp-card-shadow rounded-2xl p-6 md:p-7">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-bold text-rp-gray-500 uppercase tracking-[2px]">{title}</h2>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[11px] text-rp-gray-400 hover:text-rp-red"
          >
            × remove
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Post-submit screen. Buttons branch on the API's view of the investor:
 *  - registered + logged in:    Go to Terminal
 *  - registered + not logged in: Login
 *  - not registered:             Contact Team (WhatsApp) + Apply for Membership
 */
function CriteriaThankYou({
  locale,
  outcome,
}: {
  locale: string;
  outcome: SubmitOutcome;
}) {
  const t = useTranslations('criteria.thanks');

  const primaryBtn =
    'inline-flex items-center justify-center h-12 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-[14px] font-semibold hover:opacity-90 shadow-[0_4px_16px_rgba(188,156,69,0.25)] transition-opacity px-6';
  const secondaryBtn =
    'inline-flex items-center justify-center gap-2 h-12 rounded-lg border border-[#25D366]/40 bg-white text-[#1B7C40] text-[14px] font-semibold hover:bg-[#25D366]/[0.06] hover:border-[#25D366] transition-colors px-6';

  return (
    <div className="min-h-screen rp-page-texture relative">
      {/* Nav floats so it doesn't push the centered card down */}
      <nav className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 md:px-10 py-4 md:py-6">
        <div className="flex items-center gap-2 min-w-0">
          <RePrimeLogo width={180} variant="navy" />
          <span className="px-1.5 py-[2px] rounded bg-rp-gold text-white text-[8px] font-bold uppercase tracking-[1.5px] leading-none">
            Beta
          </span>
        </div>
      </nav>

      <div className="min-h-screen grid place-items-center px-5 md:px-10 py-24">
        <div className="max-w-[560px] w-full text-center bg-white border border-rp-gray-200 rp-card-shadow rounded-2xl p-8 md:p-10">
          {/* Success badge */}
          <div className="w-14 h-14 mx-auto rounded-full bg-rp-green-light flex items-center justify-center mb-5">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0B8A4D" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="font-[family-name:var(--font-playfair)] text-[26px] md:text-[30px] font-semibold text-rp-navy mb-3">
            {t('title')}
          </h1>
          <p className="text-[14px] text-rp-gray-600 leading-relaxed mb-2">
            {t('body')}
          </p>
          <p className="text-[12px] text-rp-gray-400 mb-8">
            {t('emailLine', { email: outcome.email })}
          </p>

          {/* Branched CTAs */}
          {outcome.isRegistered ? (
            outcome.isLoggedIn ? (
              <Link href={outcome.terminalUrl} locale={locale} className={`${primaryBtn} w-full sm:w-auto`}>
                {t('btnGoToTerminal')} →
              </Link>
            ) : (
              <Link href={outcome.loginUrl} locale={locale} className={`${primaryBtn} w-full sm:w-auto`}>
                {t('btnLogin')} →
              </Link>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {outcome.whatsappUrl && (
                <a
                  href={outcome.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${secondaryBtn} w-full`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.6 6.3A7.85 7.85 0 0012 4a7.94 7.94 0 00-6.76 12.07L4 21l5.06-1.23A7.94 7.94 0 0019.93 12a7.85 7.85 0 00-2.33-5.7zM12 18.6a6.6 6.6 0 01-3.4-.94l-.24-.14-2.52.66.67-2.46-.16-.25A6.61 6.61 0 1118.6 12 6.6 6.6 0 0112 18.6z" />
                  </svg>
                  {t('btnContactTeam')}
                </a>
              )}
              <Link
                href={outcome.joinUrl}
                locale={locale}
                className={`${primaryBtn} w-full ${outcome.whatsappUrl ? '' : 'sm:col-span-2'}`}
              >
                {t('btnApplyMembership')} →
              </Link>
            </div>
          )}

          <p className="text-[11px] text-rp-gray-400 mt-7">{t('footnote')}</p>
        </div>
      </div>
    </div>
  );
}
