'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import NDADocument from '@/components/legal/NDADocument';
import NDASignaturePanel, { type NDASignatureValues } from '@/components/legal/NDASignaturePanel';
import { formatNDADate } from '@/lib/legal/nda-text';

interface NDAModalProps {
  dealName: string;
  onSign: (type: 'blanket' | 'deal', signerInfo: { fullName: string; company: string; title: string }) => void;
  onClose: () => void;
}

export default function NDAModal({ dealName, onSign, onClose }: NDAModalProps) {
  const t = useTranslations('portal.nda');
  const tc = useTranslations('common');
  const [ndaType, setNdaType] = useState<'blanket' | 'deal'>('blanket');
  const [values, setValues] = useState<NDASignatureValues>({
    fullName: '',
    company: '',
    title: '',
    agreed: false,
  });
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  const today = formatNDADate();

  const handleSign = async () => {
    setError('');
    if (!values.fullName.trim()) { setError(t('fullNameRequired')); return; }
    if (!values.agreed) { setError(t('mustAgreeTerms')); return; }
    setSigning(true);
    try {
      await onSign(ndaType, {
        fullName: values.fullName.trim(),
        company: values.company.trim(),
        title: values.title.trim(),
      });
    } finally {
      setSigning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] max-h-[95dvh] md:max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl animate-fade-up flex flex-col"
        style={{ animationDuration: '0.25s' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="rp-dark-gradient px-5 md:px-7 py-5 md:py-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-white font-[family-name:var(--font-playfair)]">
                {t('title')}
              </h2>
              <p className="text-[11px] text-white/40 mt-0.5">
                {t('requiredBefore')}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 md:p-7">
          {/* NDA document (scrollable preview) */}
          <div className="bg-[#F7F8FA] border border-[#EEF0F4] rounded-xl p-5 mb-6 max-h-[260px] overflow-y-auto">
            <NDADocument date={today} receivingPartyName={values.fullName} showTitle />
          </div>

          {/* NDA type selection */}
          <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">{t('coverage')}</div>
          <div className="flex flex-col gap-2.5 mb-6">
            {[
              {
                value: 'blanket' as const,
                title: t('blanketNdaTitle'),
                desc: t('blanketNdaDesc'),
              },
              {
                value: 'deal' as const,
                title: t('dealSpecificTitle', { dealName }),
                desc: t('dealSpecificDesc'),
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

          {/* Signature panel */}
          <NDASignaturePanel values={values} onChange={setValues} date={today} />

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
              {signing ? t('signing') : t('signAndAccess')}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3.5 rounded-xl border border-[#EEF0F4] text-[#6B7280] text-[12px] font-medium hover:bg-[#F7F8FA] transition-colors"
            >
              {tc('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
