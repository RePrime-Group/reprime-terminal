'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Conversation } from '@/lib/ai/types';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ThreadSwitcher({ conversations, activeId, onSelect, onNew }: Props) {
  const t = useTranslations('ai');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
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
          className="absolute end-0 top-[calc(100%+6px)] w-[300px] max-h-[460px] flex flex-col bg-[#0B0E14] rounded-lg border border-white/[0.08] shadow-2xl z-10 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onNew();
            }}
            className="shrink-0 w-full px-3 py-2.5 text-start text-[12px] font-medium text-[#D4B96A] hover:bg-white/[0.04] border-b border-white/[0.06] cursor-pointer flex items-center gap-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('newThread')}
          </button>

          {conversations.length === 0 ? (
            <div className="px-3 py-4 text-[11px] text-white/40">{t('noPriorThreads')}</div>
          ) : (
            <div className="flex-1 overflow-y-auto py-0.5">
              {conversations.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSelect(c.id);
                    }}
                    className={`w-full px-3 py-1.5 text-start cursor-pointer flex items-center gap-2 group transition-colors ${
                      isActive ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`w-1 h-1 rounded-full shrink-0 transition-colors ${
                        isActive ? 'bg-[#D4B96A]' : 'bg-white/20 group-hover:bg-white/40'
                      }`}
                    />
                    <span
                      className={`flex-1 min-w-0 truncate text-[12px] leading-tight ${
                        isActive ? 'text-white' : 'text-white/80 group-hover:text-white'
                      }`}
                    >
                      {c.title || t('newThread')}
                    </span>
                    <span className="shrink-0 text-[10px] text-white/35 tabular-nums">
                      {formatRelative(c.updated_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
