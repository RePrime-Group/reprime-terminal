'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

export default function WelcomeClient() {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const t = useTranslations('portal.welcome');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('terminal_users').select('full_name, parent_investor_id').eq('id', user.id).single()
          .then(({ data }) => {
            // Team-invited sub-users aren't founding members — send them
            // straight into the portal rather than showing the founding-tier card.
            if (data?.parent_investor_id) {
              window.location.href = `/${locale}/portal`;
              return;
            }
            setUserName(data?.full_name?.split(' ')[0] ?? 'Member');
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, [locale]);

  const memberSince = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const expiresDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07090F' }}>
        <div className="w-8 h-8 border-2 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #07090F 0%, #0A1628 40%, #0E3470 100%)' }}>
      {/* Background grid */}
      <div className="fixed inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(188,156,69,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(188,156,69,0.5) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative max-w-[560px] w-full mx-4 animate-fade-up" style={{ animationDuration: '0.6s' }}>
        {/* Gold accent top */}
        <div className="h-[3px] bg-gradient-to-r from-transparent via-[#BC9C45] to-transparent rounded-t-2xl" />

        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-b-2xl overflow-hidden">
          {/* Header */}
          <div className="text-center pt-10 pb-6 px-8">
            {/* Gold badge */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#BC9C45] to-[#D4B96A] mx-auto mb-6 flex items-center justify-center shadow-[0_8px_32px_rgba(188,156,69,0.3)]" style={{ animation: 'glow 3s ease-in-out infinite' }}>
              <span className="text-white text-[36px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
            </div>

            <h1 className="font-[family-name:var(--font-playfair)] text-[32px] font-semibold text-white leading-tight mb-2">
              {t('greeting', { name: userName })}
            </h1>
            <p className="text-[15px] text-white/40">
              {t('institutionalAccess')}
            </p>
          </div>

          {/* Membership card */}
          <div className="mx-8 mb-6 rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0A1628, #0E3470)' }}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[9px] font-bold text-[#D4A843] uppercase tracking-[2px]">{t('membershipTier')}</div>
                  <div className="text-[22px] font-bold text-white mt-1">{t('foundingMember')}</div>
                </div>
                <div className="w-12 h-12 rounded-full border-2 border-[#BC9C45] flex items-center justify-center">
                  <span className="text-[#BC9C45] text-[20px]">★</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <div className="text-[9px] font-semibold text-white/30 uppercase tracking-[1.5px]">{t('annualValue')}</div>
                  <div className="text-[18px] font-bold text-white mt-0.5">$100,000</div>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3">
                  <div className="text-[9px] font-semibold text-white/30 uppercase tracking-[1.5px]">{t('status')}</div>
                  <div className="text-[14px] font-bold text-[#0B8A4D] mt-0.5">{t('complimentary')}</div>
                  <div className="text-[10px] text-white/30">{t('activeThrough', { date: expiresDate })}</div>
                </div>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-[#BC9C45]/30 to-transparent" />

            {/* Lane access */}
            <div className="p-6">
              <div className="text-[9px] font-bold text-white/30 uppercase tracking-[2px] mb-3">{t('yourAccess')}</div>
              <div className="space-y-2">
                {[
                  { lane: t('standardLane'), desc: t('allPublishedDeals'), color: '#0E3470', active: true },
                  { lane: t('acceleratedLane'), desc: t('priorityNonRefundable'), color: '#BC9C45', active: true },
                  { lane: t('rapidLane'), desc: t('rapidCloseDesc'), color: '#0B8A4D', active: true },
                ].map((l) => (
                  <div key={l.lane} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03]">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    <div className="flex-1">
                      <span className="text-[12px] font-semibold text-white">{l.lane}</span>
                      <span className="text-[11px] text-white/30 ml-2">{l.desc}</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0B8A4D" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Member since */}
          <div className="mx-8 mb-6 flex items-center justify-center gap-2 text-[11px] text-white/20">
            <span>{t('memberSince', { date: memberSince })}</span>
            <span>·</span>
            <span>{t('noFeesFounding')}</span>
          </div>

          {/* Enter Terminal button */}
          <div className="px-8 pb-8">
            <a
              href={`/${locale}/portal`}
              className="block w-full py-4 rounded-xl bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[16px] font-bold text-center shadow-[0_8px_32px_rgba(188,156,69,0.3)] hover:shadow-[0_12px_40px_rgba(188,156,69,0.4)] transition-all hover:-translate-y-0.5"
            >
              {t('enterTerminal')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
