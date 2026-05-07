'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Conversation } from '@/lib/ai/types';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function ThreadSwitcher({ conversations, activeId, onSelect, onNew }: Props) {
  const t = useTranslations('ai');
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('threadHistory')}
        className="px-2.5 py-1.5 rounded-md hover:bg-white/[0.06] text-[11px] text-white/55 hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {t('threadHistory')}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-[calc(100%+6px)] w-[280px] max-h-[320px] overflow-y-auto bg-[#0B0E14] rounded-lg border border-white/[0.08] shadow-2xl z-10"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNew();
            }}
            className="w-full px-4 py-3 text-start text-[12px] font-medium text-[#D4B96A] hover:bg-white/[0.04] border-b border-white/[0.06] cursor-pointer"
          >
            + {t('newThread')}
          </button>
          {conversations.length === 0 ? (
            <div className="px-4 py-4 text-[11px] text-white/40">{t('noPriorThreads')}</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(c.id);
                }}
                className={`w-full px-4 py-3 text-start hover:bg-white/[0.04] border-b border-white/[0.04] last:border-b-0 cursor-pointer ${
                  c.id === activeId ? 'bg-white/[0.06]' : ''
                }`}
              >
                <div className="text-[12px] text-white truncate">{c.title}</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  {new Date(c.updated_at).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
