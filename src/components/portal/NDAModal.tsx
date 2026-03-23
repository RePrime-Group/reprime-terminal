'use client';

import { useState } from 'react';

interface NDAModalProps {
  dealName: string;
  onSign: (type: 'blanket' | 'deal', signerInfo: { fullName: string; company: string; title: string }) => void;
  onClose: () => void;
}

export default function NDAModal({ dealName, onSign, onClose }: NDAModalProps) {
  const [ndaType, setNdaType] = useState<'blanket' | 'deal'>('blanket');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const handleSign = async () => {
    setError('');
    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!agreed) { setError('You must agree to the NDA terms.'); return; }
    setSigning(true);
    try {
      await onSign(ndaType, { fullName: fullName.trim(), company: company.trim(), title: title.trim() });
    } finally {
      setSigning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl animate-fade-up flex flex-col"
        style={{ animationDuration: '0.25s' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="rp-dark-gradient px-7 py-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-white font-[family-name:var(--font-playfair)]">
                Non-Disclosure Agreement
              </h2>
              <p className="text-[11px] text-white/40 mt-0.5">
                Required before accessing confidential deal materials
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-7">
          {/* NDA Text */}
          <div className="bg-[#F7F8FA] border border-[#EEF0F4] rounded-xl p-5 mb-6 max-h-[200px] overflow-y-auto">
            <div className="text-[12px] text-[#4B5563] leading-relaxed space-y-3">
              <p className="font-semibold text-[#0E3470]">MUTUAL NON-DISCLOSURE AGREEMENT</p>
              <p>
                This Non-Disclosure Agreement (&ldquo;Agreement&rdquo;) is entered into as of {today} by and between
                RePrime Group, LLC (&ldquo;Disclosing Party&rdquo;) and the undersigned recipient (&ldquo;Receiving Party&rdquo;).
              </p>
              <p>
                The Receiving Party agrees to hold in confidence all Confidential Information provided through
                the RePrime Terminal platform, including but not limited to: financial statements, rent rolls,
                operating data, purchase agreements, loan documents, environmental reports, property condition
                assessments, tenant information, and any related deal materials.
              </p>
              <p>
                The Receiving Party shall not disclose, publish, or otherwise reveal any Confidential Information
                to any third party without prior written consent. The Receiving Party acknowledges that all
                documents accessed through the platform are watermarked and tracked.
              </p>
              <p>
                This Agreement shall remain in effect for a period of two (2) years from the date of execution.
                Breach of this Agreement may result in immediate termination of platform access and legal action.
              </p>
            </div>
          </div>

          {/* NDA Type Selection */}
          <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">Coverage</div>
          <div className="flex flex-col gap-2.5 mb-6">
            {[
              {
                value: 'blanket' as const,
                title: 'Blanket NDA — All Deals',
                desc: 'Covers all current and future deals on the platform. Sign once.',
              },
              {
                value: 'deal' as const,
                title: `Deal-Specific — ${dealName} only`,
                desc: "Covers this deal only. You'll be prompted for each new deal.",
              },
            ].map((opt) => (
              <label
                key={opt.value}
                onClick={() => setNdaType(opt.value)}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  ndaType === opt.value
                    ? 'border-[#BC9C45] bg-[#FDF8ED]'
                    : 'border-[#EEF0F4] bg-white hover:border-[#D1D5DB]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                    ndaType === opt.value ? 'border-[#BC9C45]' : 'border-[#D1D5DB]'
                  }`}
                >
                  {ndaType === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-[#BC9C45]" />}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#0E3470]">{opt.title}</div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* E-Sign Form */}
          <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">Electronic Signature</div>
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-[12px] font-medium text-[#4B5563] mb-1">
                Full Legal Name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full legal name"
                className="w-full px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg text-[14px] text-[#0E3470] focus:outline-none focus:ring-[3px] focus:ring-[#BC9C45]/15 focus:border-[#BC9C45] placeholder:text-[#9CA3AF] transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#4B5563] mb-1">Company / Entity</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                  className="w-full px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg text-[14px] text-[#0E3470] focus:outline-none focus:ring-[3px] focus:ring-[#BC9C45]/15 focus:border-[#BC9C45] placeholder:text-[#9CA3AF] transition-all"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#4B5563] mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Managing Partner"
                  className="w-full px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg text-[14px] text-[#0E3470] focus:outline-none focus:ring-[3px] focus:ring-[#BC9C45]/15 focus:border-[#BC9C45] placeholder:text-[#9CA3AF] transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-[#F7F8FA] rounded-lg">
              <span className="text-[12px] text-[#6B7280]">Date:</span>
              <span className="text-[12px] font-semibold text-[#0E3470]">{today}</span>
            </div>
          </div>

          {/* Signature preview */}
          {fullName.trim() && (
            <div className="mb-5 p-4 bg-white border border-[#EEF0F4] rounded-xl">
              <div className="text-[9px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] mb-2">SIGNATURE PREVIEW</div>
              <div className="font-[family-name:var(--font-playfair)] text-[24px] italic text-[#0E3470] border-b border-[#0E3470]/20 pb-2">
                {fullName}
              </div>
            </div>
          )}

          {/* Agreement checkbox */}
          <label
            onClick={() => setAgreed(!agreed)}
            className="flex items-start gap-3 p-3.5 bg-[#F7F8FA] rounded-lg cursor-pointer mb-5"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
              agreed ? 'border-[#BC9C45] bg-[#BC9C45]' : 'border-[#D1D5DB] bg-white'
            }`}>
              {agreed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <span className="text-[12px] text-[#4B5563] leading-relaxed">
              I have read and agree to the terms of this Non-Disclosure Agreement. I understand that
              all materials accessed are confidential, watermarked, and subject to legal protection.
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[12px] text-[#DC2626] font-medium">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSign}
              disabled={signing}
              className="flex-1 py-3.5 rounded-xl bg-[#BC9C45] hover:bg-[#A88A3D] text-[#0E3470] text-[13px] font-bold transition-colors disabled:opacity-50"
            >
              {signing ? 'Signing...' : 'Sign & Access Data Room'}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3.5 rounded-xl border border-[#EEF0F4] text-[#6B7280] text-[12px] font-medium hover:bg-[#F7F8FA] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
