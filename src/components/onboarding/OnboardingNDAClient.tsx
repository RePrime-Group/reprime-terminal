'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import NDADocument from '@/components/legal/NDADocument';
import NDASignatureBlock from '@/components/legal/NDASignatureBlock';
import NDASignaturePanel, { type NDASignatureValues } from '@/components/legal/NDASignaturePanel';
import { formatNDADate } from '@/lib/legal/nda-text';

export default function OnboardingNDAClient({ locale }: { locale: string }) {
  const t = useTranslations('portal.nda');
  const router = useRouter();

  const [values, setValues] = useState<NDASignatureValues>({
    fullName: '',
    company: '',
    title: '',
    agreed: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const today = formatNDADate();

  const handleSign = async () => {
    setError('');
    if (!values.fullName.trim()) {
      setError(t('fullNameRequired'));
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
    <div className="w-full max-w-[760px] mx-auto">
      <div className="text-center mb-6">
        <h1 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-[#0E3470] mb-2">
          {t('onboardingTitle')}
        </h1>
        <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-[560px] mx-auto">
          {t('onboardingSubtitle')}
        </p>
      </div>

      {/* Document card */}
      <div className="bg-white rounded-2xl border border-[#EEF0F4] rp-card-shadow overflow-hidden mb-5">
        <div className="p-6 md:p-8 max-h-[420px] overflow-y-auto">
          <NDADocument date={today} receivingPartyName={values.fullName} showTitle />
          <NDASignatureBlock
            date={today}
            receivingPartyName={values.fullName}
            receivingPartyCompany={values.company}
          />
        </div>
      </div>

      {/* Signature card */}
      <div className="bg-white rounded-2xl border border-[#EEF0F4] rp-card-shadow p-6 md:p-8">
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
      </div>
    </div>
  );
}
