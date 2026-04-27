'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/utils/format';

export interface MarketplaceInterestInitial {
  interest_type: 'at_asking' | 'custom_price';
  target_price: number | null;
  notes: string | null;
}

interface MarketplaceInterestFormProps {
  dealId: string;
  askingPrice: number | string;
  initialInterest: MarketplaceInterestInitial | null;
}

export default function MarketplaceInterestForm({
  dealId,
  askingPrice,
  initialInterest,
}: MarketplaceInterestFormProps) {
  const t = useTranslations('portal.marketplace');
  const router = useRouter();

  const askingNum = typeof askingPrice === 'number'
    ? askingPrice
    : parseFloat(String(askingPrice).replace(/[$,\s]/g, '')) || 0;

  const [interestType, setInterestType] = useState<'at_asking' | 'custom_price'>(
    initialInterest?.interest_type ?? 'at_asking',
  );
  const [targetPrice, setTargetPrice] = useState<string>(
    initialInterest?.target_price != null ? String(initialInterest.target_price) : '',
  );
  const [notes, setNotes] = useState(initialInterest?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedAt, setSubmittedAt] = useState<number | null>(initialInterest ? Date.now() : null);

  const submit = async () => {
    setError('');
    if (interestType === 'custom_price') {
      const parsed = parseFloat(targetPrice.replace(/[$,\s]/g, ''));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Please enter a valid target price.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/marketplace-interest/${dealId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest_type: interestType,
          target_price: interestType === 'custom_price' ? targetPrice : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Failed to submit. Please try again.');
        return;
      }
      setSubmittedAt(Date.now());
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#EEF0F4] shadow-sm p-6">
      <div className="text-[11px] font-semibold text-[#0E7490] uppercase tracking-[1.5px] mb-4">
        {t('interestSectionTitle')}
      </div>

      <div className="text-[14px] font-semibold text-[#0E3470] mb-4">
        {t('iAmInterested')}
      </div>

      <div className="space-y-2 mb-5">
        {[
          { value: 'at_asking' as const, label: t('atAskingPrice', { price: formatPrice(askingNum) }) },
          { value: 'custom_price' as const, label: t('atDifferentPrice') },
        ].map((opt) => (
          <label
            key={opt.value}
            onClick={() => setInterestType(opt.value)}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              interestType === opt.value
                ? 'border-[#0E7490] bg-[#ECFDFD]'
                : 'border-[#EEF0F4] bg-white hover:border-[#D1D5DB]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                interestType === opt.value ? 'border-[#0E7490]' : 'border-[#D1D5DB]'
              }`}
            >
              {interestType === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-[#0E7490]" />}
            </div>
            <span className="text-[13px] text-[#0E3470]">{opt.label}</span>
          </label>
        ))}
      </div>

      {interestType === 'custom_price' && (
        <div className="mb-5">
          <label className="block text-[11px] font-medium text-[#4B5563] mb-1">
            {t('myTargetPrice')}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="$"
            className="w-full px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg text-[14px] text-[#0E3470] focus:outline-none focus:ring-[3px] focus:ring-[#0E7490]/15 focus:border-[#0E7490] placeholder:text-[#9CA3AF] transition-all"
          />
        </div>
      )}

      <div className="mb-4">
        <label className="block text-[11px] font-medium text-[#4B5563] mb-1">
          {t('notesOptional')}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg text-[13px] text-[#0E3470] focus:outline-none focus:ring-[3px] focus:ring-[#0E7490]/15 focus:border-[#0E7490] placeholder:text-[#9CA3AF] transition-all"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[12px] text-[#DC2626] font-medium">
          {error}
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-3 rounded-xl bg-[#0E7490] hover:bg-[#0C5E76] text-white text-[13px] font-bold transition-colors disabled:opacity-50"
      >
        {submitting
          ? t('submitting')
          : initialInterest
          ? t('updateInterest')
          : t('submitInterest')}
      </button>

      {submittedAt && !submitting && (
        <div className="mt-3 text-[12px] text-[#0E7490] text-center font-medium">
          {t('interestSubmitted')}
        </div>
      )}
    </div>
  );
}
