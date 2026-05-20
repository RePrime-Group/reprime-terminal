'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { History, Plus, ChevronDown, Trash2 } from 'lucide-react';
import type { Conversation } from '@/lib/ai/types';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete?: (conversation: Conversation) => void;
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

const CLOSE_MS = 150;

export default function ThreadSwitcher({ conversations, activeId, onSelect, onNew, onDelete }: Props) {
  const t = useTranslations('ai');
  const [present, setPresent] = useState(false); // mounted in the DOM
  const [open, setOpen] = useState(false); // drives the enter/exit transition
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMenu = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setPresent(true);
    // Mount in the closed state and let the browser paint it once (double rAF)
    // before flipping to open, so the opacity/scale transition runs reliably
    // instead of snapping open.
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };

  const closeMenu = () => {
    setOpen(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPresent(false), CLOSE_MS);
  };

  const toggleMenu = () => (open ? closeMenu() : openMenu());

  useEffect(() => {
    if (!present) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closeMenu();
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [present]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <div ref={wrapRef}>
      <button
        type="button"
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('threadHistory')}
        className={`h-8 px-2.5 rounded-lg text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-all duration-150 border ${
          open
            ? 'bg-white/[0.08] text-white border-white/[0.12]'
            : 'bg-white/[0.03] text-white/65 border-white/[0.06] hover:bg-white/[0.07] hover:text-white hover:border-white/[0.1]'
        }`}
      >
        <History size={13} strokeWidth={1.9} className="opacity-80" />
        <span className="leading-none">{t('threadHistory')}</span>
        <ChevronDown
          size={11}
          strokeWidth={2}
          className={`opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {present && (
        <div
          role="menu"
          style={{ willChange: 'opacity, transform' }}
          className={`absolute end-4 top-[calc(100%+8px)] w-[300px] max-w-[calc(100%-16px)] max-h-[420px] flex flex-col bg-[#0E1B2E] rounded-xl border border-white/[0.07] shadow-[0_16px_44px_rgba(0,0,0,0.5)] z-10 overflow-hidden origin-top-right transition-[opacity,transform] duration-150 ease-out ${
            open ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-[0.98]'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onNew();
            }}
            className="shrink-0 mx-1.5 mt-1.5 px-2.5 py-2 rounded-lg text-start text-[12px] font-medium text-white/80 hover:text-white hover:bg-white/[0.05] cursor-pointer flex items-center gap-2 transition-colors"
          >
            <Plus size={14} strokeWidth={2} className="text-[#D4B96A] shrink-0" aria-hidden />
            {t('newThread')}
          </button>

          {conversations.length === 0 ? (
            <div className="px-3 pb-4 pt-2 text-[11px] text-white/35">{t('noPriorThreads')}</div>
          ) : (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.1em] text-white/30">
                {t('threadHistory')}
              </div>
              <div className="minimal-scrollbar flex-1 overflow-y-auto px-1.5 pb-1.5 space-y-0.5">
                {conversations.map((c) => {
                  const isActive = c.id === activeId;
                  return (
                    <div
                      key={c.id}
                      className={`group/row relative flex items-center gap-2 rounded-lg pl-2.5 pr-1.5 py-1.5 transition-colors ${
                        isActive ? 'bg-[#D4B96A]/[0.1]' : 'hover:bg-white/[0.05]'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                          isActive ? 'bg-[#E8C977]' : 'bg-white/20 group-hover/row:bg-white/40'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          closeMenu();
                          onSelect(c.id);
                        }}
                        className={`flex-1 min-w-0 truncate text-start text-[12.5px] leading-tight cursor-pointer ${
                          isActive ? 'text-white font-medium' : 'text-white/80 group-hover/row:text-white'
                        }`}
                      >
                        {c.title || t('newThread')}
                      </button>

                      <span className="shrink-0 text-[10px] text-white/35 tabular-nums group-hover/row:opacity-0 transition-opacity">
                        {formatRelative(c.updated_at)}
                      </span>

                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            closeMenu();
                            onDelete(c);
                          }}
                          aria-label={t('deleteThread')}
                          title={t('deleteThread')}
                          className="absolute end-1.5 w-6 h-6 rounded-md flex items-center justify-center text-white/45 hover:text-[#F87171] hover:bg-[#F87171]/[0.12] cursor-pointer opacity-0 group-hover/row:opacity-100 transition-all"
                        >
                          <Trash2 size={13} strokeWidth={1.9} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
