'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useParams } from 'next/navigation';

const tiers = [
  {
    name: 'Standard',
    price: '$30,000',
    annual: '$30,000/yr',
    lane: 'Standard Lane',
    color: '#0E3470',
    features: [
      'Access to all published deals',
      'Full due diligence data room',
      'Financial modeling tools',
      'Meeting scheduling with team',
      'Market intelligence dashboard',
    ],
  },
  {
    name: 'Accelerated',
    price: '$75,000',
    annual: '$75,000/yr',
    lane: 'Accelerated Lane',
    color: '#BC9C45',
    featured: true,
    features: [
      'Everything in Standard',
      'Priority deal access (48hr head start)',
      'Non-refundable deposit deals',
      'Direct line to acquisition team',
      'Custom financial modeling',
      'Quarterly portfolio reviews',
    ],
  },
  {
    name: 'Institutional',
    price: '$100,000',
    annual: '$100,000/yr',
    lane: 'Rapid Lane',
    color: '#0B8A4D',
    features: [
      'Everything in Accelerated',
      '14-21 day rapid close deals',
      'Co-investment opportunities',
      'Board-level market briefings',
      'White-glove concierge service',
      'First look at all acquisitions',
      'Custom deal sourcing',
    ],
  },
];

export default function JoinPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const [formData, setFormData] = useState({ name: '', email: '', company: '', phone: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #07090F 0%, #0A1628 30%, #0E3470 80%, #163D7A 100%)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded-lg flex items-center justify-center shadow-[0_2px_8px_rgba(188,156,69,0.3)]">
            <span className="text-white font-bold text-lg font-[family-name:var(--font-playfair)] italic">R</span>
          </div>
          <span className="text-white font-medium text-[14px] tracking-[4px] uppercase">REPRIME</span>
          <span className="font-[family-name:var(--font-playfair)] text-[#D4A843] italic text-[11px]">Terminal</span>
        </div>
        <Link
          href="/login"
          locale={locale}
          className="px-5 py-2 border border-white/15 text-white/70 text-[12px] font-medium rounded-lg hover:bg-white/5 transition-colors"
        >
          Investor Login
        </Link>
      </nav>

      {/* Hero */}
      <div className="max-w-[1200px] mx-auto px-10 pt-12 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0B8A4D] live-dot" />
          <span className="text-[10px] font-medium tracking-[2px] text-[#D4A843] uppercase">Founding Members — Limited Positions</span>
        </div>
        <h1 className="font-[family-name:var(--font-playfair)] text-[48px] font-semibold text-white leading-[1.1] tracking-[-0.02em] mb-5">
          Institutional CRE Access
        </h1>
        <p className="text-[16px] text-white/40 max-w-[600px] mx-auto leading-relaxed font-light mb-3">
          The RePrime Terminal connects qualified investors with off-market commercial real
          estate opportunities backed by 30+ years of institutional diligence.
        </p>
        <p className="text-[14px] text-[#D4A843] font-semibold">
          Founding members receive complimentary access through December 2027
        </p>
      </div>

      {/* Pricing Tiers */}
      <div className="max-w-[1200px] mx-auto px-10 pb-12">
        <div className="grid grid-cols-3 gap-5">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-[1px] ${
                tier.featured
                  ? 'bg-gradient-to-b from-[#BC9C45] to-[#BC9C45]/20'
                  : 'bg-white/[0.08]'
              }`}
            >
              <div className={`rounded-2xl p-7 h-full flex flex-col ${
                tier.featured ? 'bg-[#0A1628]' : 'bg-white/[0.03]'
              }`}>
                {tier.featured && (
                  <div className="text-center mb-4">
                    <span className="text-[9px] font-bold tracking-[2px] text-[#D4A843] uppercase bg-[#BC9C45]/10 px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                <h3 className="text-[18px] font-semibold text-white mb-1">{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[32px] font-bold text-white">{tier.price}</span>
                  <span className="text-[13px] text-white/30">/year</span>
                </div>
                <div className="mb-5">
                  <span className="text-[12px] font-semibold text-[#0B8A4D] bg-[#0B8A4D]/10 px-2.5 py-1 rounded-full">
                    Complimentary for Founding Members
                  </span>
                </div>
                <div className="text-[11px] text-white/30 mb-4 pb-4 border-b border-white/[0.06]">
                  <span className="font-semibold text-white/50">{tier.lane}</span> — {
                    tier.name === 'Standard' ? 'Access to all published deals' :
                    tier.name === 'Accelerated' ? 'Priority access + non-refundable deposit deals' :
                    '14-21 day rapid close + co-investment'
                  }
                </div>
                <ul className="space-y-3 flex-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/60">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tier.color} strokeWidth="2.5" className="shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Founding Member Banner */}
      <div className="max-w-[1200px] mx-auto px-10 pb-12">
        <div className="bg-white/[0.03] border border-[#BC9C45]/20 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#BC9C45] to-[#D4B96A] flex items-center justify-center">
              <span className="text-white text-[18px]">★</span>
            </div>
          </div>
          <h2 className="font-[family-name:var(--font-playfair)] text-[24px] font-semibold text-white mb-2">
            Founding Member Access
          </h2>
          <p className="text-[14px] text-white/40 max-w-[500px] mx-auto mb-2">
            All founding members receive our highest membership level, valued at $100,000 annually.
            No membership fees apply during the founding period.
          </p>
          <p className="text-[12px] text-[#D4A843] font-semibold">
            Limited founding positions remaining
          </p>
        </div>
      </div>

      {/* Application Form */}
      <div className="max-w-[1200px] mx-auto px-10 pb-16">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-10">
          <h2 className="font-[family-name:var(--font-playfair)] text-[24px] font-semibold text-white mb-2 text-center">
            {submitted ? 'Application Received' : 'Membership Application'}
          </h2>
          <p className="text-[13px] text-white/40 mb-8 text-center">
            {submitted
              ? 'Our team will review your application within 48 hours.'
              : 'Founding membership is by invitation only. Applications reviewed within 48 hours.'
            }
          </p>

          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#0B8A4D]/20 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0B8A4D" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[15px] text-white font-semibold mb-2">Thank you, {formData.name.split(' ')[0]}.</p>
              <p className="text-[13px] text-white/40">We&apos;ll be in touch shortly.</p>
            </div>
          ) : (
            <div className="max-w-[500px] mx-auto flex flex-col gap-4">
              <input type="text" placeholder="Full Name" value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors" />
              <input type="email" placeholder="Email Address" value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors" />
              <input type="text" placeholder="Company / Fund Name" value={formData.company}
                onChange={(e) => setFormData(p => ({ ...p, company: e.target.value }))}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors" />
              <input type="tel" placeholder="Phone Number" value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors" />
              <button
                onClick={() => setSubmitted(true)}
                className="w-full py-4 rounded-lg bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[15px] font-bold hover:opacity-90 transition-opacity shadow-[0_6px_24px_rgba(188,156,69,0.3)] mt-2"
              >
                Apply for Membership
              </button>
              <p className="text-[11px] text-white/20 text-center">
                Membership is restricted to accredited investors and qualified purchasers.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded flex items-center justify-center">
            <span className="text-white text-[8px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
          </div>
          <span className="text-[10px] text-white/20 tracking-wide">REPRIME TERMINAL</span>
        </div>
        <p className="text-[10px] text-white/20">
          &copy; {new Date().getFullYear()} RePrime Group. All rights reserved. All investments involve risk.
        </p>
      </div>
    </div>
  );
}
