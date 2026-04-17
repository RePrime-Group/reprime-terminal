'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';

interface WatchlistModalProps {
  dealName: string;
  dealId: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function WatchlistModal({ dealName, dealId, onClose, onConfirm }: WatchlistModalProps) {
  const t = useTranslations('portal.watchlist');
  const tc = useTranslations('common');
  const [freq, setFreq] = useState<'every' | 'daily' | 'weekly'>('every');
  const [channels, setChannels] = useState({ email: true, whatsapp: false, sms: false });
  const [types, setTypes] = useState({ docs: true, deadlines: true, price: true, competing: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCh = (k: keyof typeof channels) => setChannels((p) => ({ ...p, [k]: !p[k] }));
  const toggleTy = (k: keyof typeof types) => setTypes((p) => ({ ...p, [k]: !p[k] }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency: freq, channels, alert_types: types }),
      });
      if (!res.ok) {
        setError(await readApiError(res, 'We couldn\u2019t save your alert preferences. Please try again.'));
        return;
      }
      onConfirm();
    } catch (err) {
      console.error('watchlist save failed:', err);
      setError(friendlyFetchError(err, 'We couldn\u2019t save your alert preferences. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] max-h-[95dvh] overflow-y-auto bg-white rounded-2xl shadow-2xl animate-fade-up"
        style={{ animationDuration: '0.25s' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rp-dark-gradient px-5 md:px-7 py-5">
          <div className="text-[16px] font-semibold text-white font-[family-name:var(--font-playfair)]">
            {t('setAlerts', { dealName })}
          </div>
          <div className="text-[11px] text-white/40 mt-1">{t('getNotified')}</div>
        </div>

        <div className="p-5 md:p-7">
          {/* Frequency */}
          <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">{t('frequency')}</div>
          <div className="flex gap-2 mb-6">
            {([['every', t('everyUpdate')], ['daily', t('dailyDigest')], ['weekly', t('weeklySummary')]] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFreq(v)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-[11px] font-semibold transition-all ${
                  freq === v
                    ? 'border-2 border-[#BC9C45] bg-[#FDF8ED] text-[#0E3470]'
                    : 'border border-[#EEF0F4] bg-white text-[#6B7280] hover:border-[#D1D5DB]'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Channels */}
          <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">{t('channels')}</div>
          <div className="flex gap-2 mb-6">
            {([['email', t('email'), '📧'], ['whatsapp', t('whatsapp'), '💬'], ['sms', t('sms'), '📱']] as const).map(([k, l, ic]) => (
              <button
                key={k}
                onClick={() => toggleCh(k)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  channels[k]
                    ? 'border-2 border-[#BC9C45] bg-[#FDF8ED] text-[#0E3470]'
                    : 'border border-[#EEF0F4] bg-white text-[#6B7280] hover:border-[#D1D5DB]'
                }`}
              >
                {ic} {l}
              </button>
            ))}
          </div>

          {/* Alert Types */}
          <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">{t('alertTypes')}</div>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {([['docs', t('newDocuments')], ['deadlines', t('deadlineChanges')], ['price', t('priceUpdates')], ['competing', t('competingInterest')]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => toggleTy(k)}
                className={`py-2.5 px-3 rounded-lg text-[11px] font-semibold transition-all text-left ${
                  types[k]
                    ? 'border-2 border-[#BC9C45] bg-[#FDF8ED] text-[#0E3470]'
                    : 'border border-[#EEF0F4] bg-white text-[#6B7280] hover:border-[#D1D5DB]'
                }`}
              >
                {types[k] ? '✓ ' : ''}{l}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#DC2626]">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3.5 rounded-xl bg-[#BC9C45] hover:bg-[#A88A3D] text-[#0E3470] text-[13px] font-bold transition-colors disabled:opacity-50"
            >
              {saving ? tc('saving') : t('startWatching')}
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
