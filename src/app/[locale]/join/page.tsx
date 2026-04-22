'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

const tiers = [
  {
    nameKey: 'standard' as const,
    price: '$30,000',
    annual: '$30,000/yr',
    laneKey: 'standardLane' as const,
    laneDescKey: 'standardLaneDesc' as const,
    color: '#0E3470',
    featureKeys: [
      'featureAccessDeals',
      'featureDataRoom',
      'featureFinancialTools',
      'featureMeetings',
      'featureMarketIntel',
    ] as const,
  },
  {
    nameKey: 'accelerated' as const,
    price: '$75,000',
    annual: '$75,000/yr',
    laneKey: 'acceleratedLane' as const,
    laneDescKey: 'acceleratedLaneDesc' as const,
    color: '#BC9C45',
    featured: true,
    featureKeys: [
      'featureEverythingStandard',
      'featurePriorityAccess',
      'featureNonRefundable',
      'featureDirectLine',
      'featureCustomModeling',
      'featureQuarterlyReviews',
    ] as const,
  },
  {
    nameKey: 'institutional' as const,
    price: '$100,000',
    annual: '$100,000/yr',
    laneKey: 'rapidLane' as const,
    laneDescKey: 'rapidLaneDesc' as const,
    color: '#0B8A4D',
    featureKeys: [
      'featureEverythingAccelerated',
      'featureRapidClose',
      'featureCoInvestment',
      'featureBoardBriefings',
      'featureWhiteGlove',
      'featureFirstLook',
      'featureCustomSourcing',
    ] as const,
  },
];

export default function JoinPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const t = useTranslations('join');
  const [formData, setFormData] = useState({ name: '', email: '', company: '', phone: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.name.trim(),
          email: formData.email.trim(),
          company_name: formData.company.trim() || null,
          phone: formData.phone.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || t('somethingWentWrong'));
      } else {
        setSubmitted(true);
      }
    } catch {
      setError(t('failedToSubmit'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #07090F 0%, #0A1628 40%, #0F1A2E 70%, #07090F 100%)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-5 md:px-10 py-4 md:py-6 gap-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded-lg flex items-center justify-center shadow-[0_2px_8px_rgba(188,156,69,0.3)]">
            <span className="text-white font-bold text-lg font-[family-name:var(--font-playfair)] italic">R</span>
          </div>
          <span className="text-white font-medium text-[13px] md:text-[14px] tracking-[3px] md:tracking-[4px] uppercase">REPRIME</span>
          <span className="font-[family-name:var(--font-playfair)] text-[#D4A843] italic text-[11px] hidden sm:inline">Terminal</span>
        </div>
        <Link
          href="/login"
          locale={locale}
          className="shrink-0 px-3.5 md:px-5 py-2 border border-white/15 text-white/70 text-[12px] font-medium rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap"
        >
          {t('investorLogin')}
        </Link>
      </nav>

      {/* Hero */}
      <div className="max-w-[1200px] mx-auto px-5 md:px-10 pt-4 md:pt-6 pb-5 md:pb-7 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4 md:mb-5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0B8A4D] live-dot" />
          <span className="text-[10px] font-medium tracking-[2px] text-[#D4A843] uppercase">{t('foundingBadge')}</span>
        </div>
        <h1 className="font-[family-name:var(--font-playfair)] text-[30px] sm:text-[36px] md:text-[48px] font-semibold text-white leading-[1.1] tracking-[-0.02em] mb-4 md:mb-5">
          {t('heroTitle')}
        </h1>
        <p className="text-[14px] md:text-[16px] text-white/40 max-w-[600px] mx-auto leading-relaxed font-light mb-3">
          {t('heroDescription')}
        </p>
        <p className="text-[13px] md:text-[14px] text-[#D4A843] font-semibold">
          {t('foundingAccess')}
        </p>
      </div>

      {/* Pricing Tiers */}
      <div className="max-w-[1200px] mx-auto px-5 md:px-10 pb-6 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {tiers.map((tier) => (
            <div
              key={tier.nameKey}
              className={`rounded-2xl p-[1px] ${
                tier.featured
                  ? 'bg-gradient-to-b from-[#BC9C45] to-[#BC9C45]/20'
                  : 'bg-white/[0.08]'
              }`}
            >
              <div className={`rounded-2xl p-6 md:p-7 h-full flex flex-col ${
                tier.featured ? 'bg-[#0A1628]' : 'bg-white/[0.03]'
              }`}>
                {tier.featured && (
                  <div className="text-center mb-4">
                    <span className="text-[9px] font-bold tracking-[2px] text-[#D4A843] uppercase bg-[#BC9C45]/10 px-3 py-1 rounded-full">
                      {t('mostPopular')}
                    </span>
                  </div>
                )}
                <h3 className="text-[18px] font-semibold text-white mb-1">{t(tier.nameKey)}</h3>
                <div className="flex items-baseline gap-1 mb-1 flex-wrap">
                  <span className="text-[28px] md:text-[32px] font-bold text-white">{tier.price}</span>
                  <span className="text-[13px] text-white/30">{t('perYear')}</span>
                </div>
                <div className="mb-5">
                  <span className="text-[12px] font-semibold text-[#0B8A4D] bg-[#0B8A4D]/10 px-2.5 py-1 rounded-full">
                    {t('complimentaryFounding')}
                  </span>
                </div>
                <div className="text-[11px] text-white/30 mb-4 pb-4 border-b border-white/[0.06]">
                  <span className="font-semibold text-white/50">{t(tier.laneKey)}</span> — {t(tier.laneDescKey)}
                </div>
                <ul className="space-y-3 flex-1">
                  {tier.featureKeys.map((fKey, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/60">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tier.color} strokeWidth="2.5" className="shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {t(fKey)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Founding Member Banner */}
      <div className="max-w-[1200px] mx-auto px-5 md:px-10 pb-6 md:pb-8">
        <div className="bg-white/[0.03] border border-[#BC9C45]/20 rounded-2xl p-5 md:p-7 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#BC9C45] to-[#D4B96A] flex items-center justify-center">
              <span className="text-white text-[18px]">★</span>
            </div>
          </div>
          <h2 className="font-[family-name:var(--font-playfair)] text-[20px] md:text-[24px] font-semibold text-white mb-2">
            {t('foundingMemberAccess')}
          </h2>
          <p className="text-[13px] md:text-[14px] text-white/40 max-w-[500px] mx-auto mb-2">
            {t('foundingMemberDesc')}
          </p>
          <p className="text-[12px] text-[#D4A843] font-semibold">
            {t('limitedPositions')}
          </p>
        </div>
      </div>

      {/* Application Form */}
      <div className="max-w-[1200px] mx-auto px-5 md:px-10 pb-6 md:pb-8">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 md:p-8">
          <h2 className="font-[family-name:var(--font-playfair)] text-[20px] md:text-[24px] font-semibold text-white mb-2 text-center">
            {submitted ? t('applicationReceived') : t('membershipApplication')}
          </h2>
          <p className="text-[13px] text-white/40 mb-5 md:mb-6 text-center">
            {submitted
              ? t('reviewWithin48')
              : t('foundingByInvitation')
            }
          </p>

          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#0B8A4D]/20 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0B8A4D" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[15px] text-white font-semibold mb-2">{t('thankYou', { name: formData.name.split(' ')[0] })}</p>
              <p className="text-[13px] text-white/40">{t('inTouchShortly')}</p>
            </div>
          ) : (
            <div className="max-w-[500px] mx-auto flex flex-col gap-4">
              <input type="text" placeholder={t('fullName')} value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors" />
              <input type="email" placeholder={t('emailAddress')} value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors" />
              <input type="text" placeholder={t('companyFundName')} value={formData.company}
                onChange={(e) => setFormData(p => ({ ...p, company: e.target.value }))}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors" />
              <input type="tel" placeholder={t('phoneNumber')} value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors" />
              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">{error}</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={loading || !formData.name.trim() || !formData.email.trim()}
                className="w-full py-4 rounded-lg bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[15px] font-bold hover:opacity-90 transition-opacity shadow-[0_6px_24px_rgba(188,156,69,0.3)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('submitting') : t('applyForMembership')}
              </button>
              <p className="text-[11px] text-white/20 text-center">
                {t('membershipRestricted')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Have a code? */}
      <div className="max-w-[1200px] mx-auto px-5 md:px-10 pb-6 md:pb-10">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 md:p-7 text-center">
          <h3 className="text-[16px] md:text-[18px] font-semibold text-white mb-2">{t('haveInvitationCode')}</h3>
          <p className="text-[13px] text-white/40 mb-5">{t('enterCodeBelow')}</p>
          <div className="max-w-[400px] mx-auto flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder={t('enterInvitationCode')}
              id="invite-code-input"
              className="flex-1 min-w-0 px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors"
            />
            <button
              onClick={() => {
                const input = document.getElementById('invite-code-input') as HTMLInputElement;
                if (input?.value.trim()) {
                  window.location.href = `/${locale}/invite/${input.value.trim()}`;
                }
              }}
              className="px-6 py-3.5 rounded-lg bg-[#BC9C45] text-[#0E3470] text-[14px] font-bold hover:opacity-90 transition-opacity shrink-0"
            >
              {t('activate')}
            </button>
          </div>
          <div className="mt-4">
            <Link
              href="/login"
              locale={locale}
              className="text-[12px] text-[#BC9C45] hover:text-[#D4B96A] font-medium transition-colors"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-5 md:px-10 py-5 md:py-6 flex flex-col sm:flex-row items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded flex items-center justify-center">
            <span className="text-white text-[8px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
          </div>
          <span className="text-[10px] text-white/20 tracking-wide">REPRIME TERMINAL BETA</span>
        </div>
        <p className="text-[10px] text-white/20 text-center">
          {t('copyright', { year: new Date().getFullYear().toString() })}
        </p>
      </div>
    </div>
  );
}
