'use client';

import { useTranslations } from 'next-intl';
import SignaturePad from './SignaturePad';

export interface NDASignatureValues {
  fullName: string;
  company: string;
  title: string;
  agreed: boolean;
  eSignConsent: boolean;
  signatureMode: 'type' | 'draw';
  signatureDataUrl: string;
}

interface NDASignaturePanelProps {
  values: NDASignatureValues;
  onChange: (next: NDASignatureValues) => void;
  date: string;
  /** Optional caption shown above the signature preview block. */
  showSignaturePreview?: boolean;
}

export default function NDASignaturePanel({
  values,
  onChange,
  date,
  showSignaturePreview = true,
}: NDASignaturePanelProps) {
  const t = useTranslations('portal.nda');
  const set = <K extends keyof NDASignatureValues>(key: K, val: NDASignatureValues[K]) =>
    onChange({ ...values, [key]: val });

  return (
    <>
      <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">
        {t('electronicSignature')}
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <label className="block text-[12px] font-medium text-[#4B5563] mb-1">
            {t('fullLegalName')}
          </label>
          <input
            type="text"
            value={values.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            placeholder={t('enterLegalName')}
            className="w-full px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg text-[14px] text-[#0E3470] focus:outline-none focus:ring-[3px] focus:ring-[#BC9C45]/15 focus:border-[#BC9C45] placeholder:text-[#9CA3AF] transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-[#4B5563] mb-1">
              {t('companyEntity')}
            </label>
            <input
              type="text"
              value={values.company}
              onChange={(e) => set('company', e.target.value)}
              placeholder={t('companyName')}
              className="w-full px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg text-[14px] text-[#0E3470] focus:outline-none focus:ring-[3px] focus:ring-[#BC9C45]/15 focus:border-[#BC9C45] placeholder:text-[#9CA3AF] transition-all"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#4B5563] mb-1">
              {t('titleLabel')}
              {values.company.trim() && <span className="text-[#BC9C45]"> *</span>}
            </label>
            <input
              type="text"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={t('titlePlaceholder')}
              className="w-full px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg text-[14px] text-[#0E3470] focus:outline-none focus:ring-[3px] focus:ring-[#BC9C45]/15 focus:border-[#BC9C45] placeholder:text-[#9CA3AF] transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-[#F7F8FA] rounded-lg">
          <span className="text-[12px] text-[#6B7280]">{t('date')}</span>
          <span className="text-[12px] font-semibold text-[#0E3470]">{date}</span>
        </div>
      </div>

      {showSignaturePreview && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[9px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px]">
              {t('signaturePreview')}
            </div>
            <div className="flex gap-0.5 rounded-lg bg-[#F2F4F8] p-0.5">
              {(['type', 'draw'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set('signatureMode', m)}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    values.signatureMode === m ? 'bg-white text-[#0E3470] shadow-sm' : 'text-[#6B7280] hover:text-[#0E3470]'
                  }`}
                >
                  {m === 'type' ? t('sigType') : t('sigDraw')}
                </button>
              ))}
            </div>
          </div>

          {values.signatureMode === 'draw' ? (
            <SignaturePad onChange={(d) => set('signatureDataUrl', d)} clearLabel={t('clearSignature')} />
          ) : values.fullName.trim() ? (
            <div className="p-4 bg-white border border-[#EEF0F4] rounded-xl">
              <div className="font-[family-name:var(--font-playfair)] text-[24px] italic text-[#0E3470] border-b border-[#0E3470]/20 pb-2">
                {values.fullName}
              </div>
            </div>
          ) : (
            <div className="p-4 border border-dashed border-[#E5E7EB] rounded-xl text-[12px] text-[#9CA3AF]">
              {t('typeNameHint')}
            </div>
          )}
        </div>
      )}

      <label
        onClick={() => set('eSignConsent', !values.eSignConsent)}
        className="flex items-start gap-3 p-3.5 bg-[#F7F8FA] rounded-lg cursor-pointer mb-3"
      >
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
            values.eSignConsent ? 'border-[#BC9C45] bg-[#BC9C45]' : 'border-[#D1D5DB] bg-white'
          }`}
        >
          {values.eSignConsent && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <span className="text-[12px] text-[#4B5563] leading-relaxed">{t('eSignConsent')}</span>
      </label>

      <label
        onClick={() => set('agreed', !values.agreed)}
        className="flex items-start gap-3 p-3.5 bg-[#F7F8FA] rounded-lg cursor-pointer mb-5"
      >
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
            values.agreed ? 'border-[#BC9C45] bg-[#BC9C45]' : 'border-[#D1D5DB] bg-white'
          }`}
        >
          {values.agreed && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <span className="text-[12px] text-[#4B5563] leading-relaxed">{t('agreeText')}</span>
      </label>
    </>
  );
}
