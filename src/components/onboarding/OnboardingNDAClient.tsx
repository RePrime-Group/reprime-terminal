'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import NDADocument from '@/components/legal/NDADocument';
import NDASignatureBlock from '@/components/legal/NDASignatureBlock';
import NDASignaturePanel, { type NDASignatureValues } from '@/components/legal/NDASignaturePanel';
import { formatNDADate } from '@/lib/legal/nda-text';
import { downloadNdaCopy } from '@/lib/legal/download-nda';

export default function OnboardingNDAClient({ locale }: { locale: string }) {
  const t = useTranslations('portal.nda');
  const router = useRouter();

  const [values, setValues] = useState<NDASignatureValues>({
    fullName: '',
    company: '',
    title: '',
    agreed: false,
    eSignConsent: false,
    signatureMode: 'type',
    signatureDataUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const today = formatNDADate();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadNdaCopy({
        date: today,
        receivingPartyName: values.fullName.trim(),
        receivingPartyCompany: values.company.trim() || undefined,
        receivingPartyTitle: values.title.trim() || undefined,
        signatureDataUrl: values.signatureMode === 'draw' ? values.signatureDataUrl : undefined,
        signed: false,
      });
    } catch {
      setError(t('downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const handleSign = async () => {
    setError('');
    if (!values.fullName.trim()) {
      setError(t('fullNameRequired'));
      return;
    }
    if (values.company.trim() && !values.title.trim()) {
      setError(t('titleRequiredWithCompany'));
      return;
    }
    if (values.signatureMode === 'draw' && !values.signatureDataUrl) {
      setError(t('drawSignatureRequired'));
      return;
    }
    if (!values.eSignConsent) {
      setError(t('eSignConsentRequired'));
      return;
    }
    if (!values.agreed) {
      setError(t('mustAgreeTerms'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/nda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          company: values.company.trim() || null,
          title: values.title.trim() || null,
          signatureDataUrl: values.signatureMode === 'draw' ? values.signatureDataUrl : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Failed to save signature. Please try again.');
        setSubmitting(false);
        return;
      }
      router.replace(`/${locale}/portal`);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[1120px] mx-auto">
      <div className="text-center mb-6">
        <h1 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-[#0E3470] mb-2">
          {t('onboardingTitle')}
        </h1>
        <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-[560px] mx-auto">
          {t('onboardingSubtitle')}
        </p>
      </div>

      {/* Two columns: document (left, page scroll) + sticky sign panel (right).
          Single scrollbar — the page — so no dual-scroll confusion. Stacks to
          one column on mobile (document first, then sign panel). */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(340px,380px)] gap-5 lg:gap-6 items-start">
        {/* Document column */}
        <div className="bg-white rounded-2xl border border-[#EEF0F4] rp-card-shadow">
          <div className="p-6 md:p-10">
            <NDADocument date={today} receivingPartyName={values.fullName} showTitle />
            <NDASignatureBlock
              date={today}
              receivingPartyName={values.fullName}
              receivingPartyCompany={values.company}
            />
          </div>
        </div>

        {/* Sign column — sticky on desktop so the action stays in view */}
        <div className="lg:sticky lg:top-6">
          <div className="bg-white rounded-2xl border border-[#EEF0F4] rp-card-shadow p-6 md:p-7">
            <NDASignaturePanel values={values} onChange={setValues} date={today} />

            {error && (
              <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[12px] text-[#DC2626] font-medium">
                {error}
              </div>
            )}

            <button
              onClick={handleSign}
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#BC9C45] hover:bg-[#A88A3D] text-[#0E3470] text-[13px] font-bold transition-colors disabled:opacity-50"
            >
              {submitting ? t('signing') : t('signAndContinue')}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full mt-3 py-2.5 rounded-xl border border-[#EEF0F4] text-[#6B7280] text-[12px] font-medium hover:bg-[#F7F8FA] transition-colors disabled:opacity-50"
            >
              {downloading ? t('preparing') : t('downloadCopy')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
