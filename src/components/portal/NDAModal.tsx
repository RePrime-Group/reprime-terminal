'use client';

import { useState } from 'react';

interface NDAModalProps {
  dealName: string;
  onSign: (type: 'blanket' | 'deal') => void;
  onClose: () => void;
}

export default function NDAModal({ dealName, onSign, onClose }: NDAModalProps) {
  const [ndaType, setNdaType] = useState<'blanket' | 'deal'>('blanket');

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="w-[520px] bg-white rounded-2xl overflow-hidden shadow-2xl animate-fade-up"
        style={{ animationDuration: '0.25s' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="rp-dark-gradient px-7 py-6">
          <h2 className="text-[18px] font-semibold text-white font-[family-name:var(--font-playfair)]">
            Non-Disclosure Agreement
          </h2>
          <p className="text-[12px] text-white/40 mt-1">
            Required before accessing confidential deal materials
          </p>
        </div>

        {/* Body */}
        <div className="p-7">
          <p className="text-[13px] text-[#4B5563] leading-relaxed mb-5">
            All materials in the data room are confidential and proprietary. By proceeding, you agree
            to maintain strict confidentiality regarding all deal information, financial data, and
            documentation.
          </p>

          {/* NDA Type Selection */}
          <div className="flex flex-col gap-3 mb-6">
            {[
              {
                value: 'blanket' as const,
                title: 'Blanket NDA — All Deals',
                desc: 'Covers all current and future deals on the platform. Sign once.',
              },
              {
                value: 'deal' as const,
                title: `Deal-Specific NDA — ${dealName} only`,
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
                  {ndaType === opt.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#BC9C45]" />
                  )}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#0E3470]">{opt.title}</div>
                  <div className="text-[11px] text-[#6B7280] mt-1">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => onSign(ndaType)}
              className="flex-1 py-3.5 rounded-xl bg-[#BC9C45] hover:bg-[#A88A3D] text-[#0E3470] text-[13px] font-bold transition-colors"
            >
              Sign & Access Data Room
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
