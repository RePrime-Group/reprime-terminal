'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { TerminalCrmMessage } from '@/lib/types/database';
import CrmMessageForm from './CrmMessageForm';
import CrmTimelineEntry from './CrmTimelineEntry';

export default function CrmTimeline({
  investorId,
  messages,
}: {
  investorId: string;
  messages: TerminalCrmMessage[];
}) {
  const t = useTranslations('admin.crm');
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const refresh = () => router.refresh();

  const pinned = messages.filter((m) => m.is_pinned);
  const rest = messages.filter((m) => !m.is_pinned);

  return (
    <div className="flex flex-col gap-4">
      {/* Add message */}
      {adding ? (
        <CrmMessageForm
          investorId={investorId}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90"
        >
          + {t('addMessage')}
        </button>
      )}

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold text-rp-gray-500 uppercase tracking-wider">
            📌 {t('pinnedSection')}
          </div>
          {pinned.map((m) => (
            <CrmTimelineEntry key={m.id} message={m} onChanged={refresh} />
          ))}
        </div>
      )}

      {/* Chronological */}
      {messages.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-rp-gray-200">
          <p className="text-sm text-rp-gray-500">{t('noMessages')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rest.map((m) => (
            <CrmTimelineEntry key={m.id} message={m} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
