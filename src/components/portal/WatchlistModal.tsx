'use client';

import { useState } from 'react';

interface WatchlistModalProps {
  dealName: string;
  dealId: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function WatchlistModal({ dealName, dealId, onClose, onConfirm }: WatchlistModalProps) {
  const [freq, setFreq] = useState<'every' | 'daily' | 'weekly'>('every');
  const [channels, setChannels] = useState({ email: true, whatsapp: false, sms: false });
  const [types, setTypes] = useState({ docs: true, deadlines: true, price: true, competing: true });
  const [saving, setSaving] = useState(false);

  const toggleCh = (k: keyof typeof channels) => setChannels((p) => ({ ...p, [k]: !p[k] }));
  const toggleTy = (k: keyof typeof types) => setTypes((p) => ({ ...p, [k]: !p[k] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/deals/${dealId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency: freq, channels, alert_types: types }),
      });
      onConfirm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        className="w-[480px] bg-white rounded-2xl overflow-hidden shadow-2xl animate-fade-up"
        style={{ animationDuration: '0.25s' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rp-dark-gradient px-7 py-5">
          <div className="text-[16px] font-semibold text-white font-[family-name:var(--font-playfair)]">
            Set Alerts for {dealName}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Get notified about important updates</div>
        </div>

        <div className="p-7">
          {/* Frequency */}
          <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">Frequency</div>
          <div className="flex gap-2 mb-6">
            {([['every', 'Every update'], ['daily', 'Daily digest'], ['weekly', 'Weekly summary']] as const).map(([v, l]) => (
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
          <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">Channels</div>
          <div className="flex gap-2 mb-6">
            {([['email', 'Email', '📧'], ['whatsapp', 'WhatsApp', '💬'], ['sms', 'SMS', '📱']] as const).map(([k, l, ic]) => (
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
          <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-3">Alert Types</div>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {([['docs', 'New documents'], ['deadlines', 'Deadline changes'], ['price', 'Price updates'], ['competing', 'Competing interest']] as const).map(([k, l]) => (
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

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3.5 rounded-xl bg-[#BC9C45] hover:bg-[#A88A3D] text-[#0E3470] text-[13px] font-bold transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Start Watching'}
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
