'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled: boolean;
  isStreaming?: boolean;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const MAX_HEIGHT = 160;

export default function Composer({ onSend, onStop, disabled, isStreaming = false }: Props) {
  const t = useTranslations('ai');
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${next}px`;
    if (el.scrollHeight > MAX_HEIGHT) {
      el.scrollTop = el.scrollHeight;
    }
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    requestAnimationFrame(() => ref.current?.focus());
  };

  const canSend = !disabled && value.trim().length > 0;
  const showStop = isStreaming && !!onStop;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-white/[0.06] bg-[#0B0E14] px-3 pt-2.5 pb-3"
    >
      <div
        className={`flex items-start gap-2 rounded-2xl border bg-white/[0.03] ps-3.5 pe-2 py-2 transition-[border-color,background-color,box-shadow] duration-200 ${
          disabled
            ? 'border-white/[0.06] opacity-70'
            : 'border-white/[0.08] focus-within:border-[#BC9C45]/45 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_3px_rgba(188,156,69,0.10)]'
        }`}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={t('askPlaceholder')}
          aria-label={t('askPlaceholder')}
          disabled={disabled}
          className="flex-1 min-w-0 self-stretch bg-transparent resize-none outline-none text-[13px] leading-[1.6] text-white placeholder:text-white/30 py-[6px] max-h-[160px] disabled:cursor-not-allowed"
        />

        <span className="relative group/voice shrink-0 self-end mb-[2px] inline-flex">
          <button
            type="button"
            disabled
            aria-label={t('voiceInput')}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-[#E8C977]/45 via-[#D4B96A]/45 to-[#A88A3D]/45 text-[#0B0E14]/70 shadow-[0_2px_8px_rgba(212,185,106,0.18)] cursor-not-allowed pointer-events-none"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="5" y1="11" x2="5" y2="13" />
              <line x1="9" y1="9" x2="9" y2="15" />
              <line x1="13" y1="6" x2="13" y2="18" />
              <line x1="17" y1="9" x2="17" y2="15" />
              <line x1="21" y1="11" x2="21" y2="13" />
            </svg>
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full mb-2 end-0 px-2 py-1 rounded-md bg-[#1a1f2e] border border-white/[0.08] text-white/85 text-[10px] font-medium whitespace-nowrap shadow-[0_4px_14px_rgba(0,0,0,0.45)] opacity-0 translate-y-1 group-hover/voice:opacity-100 group-hover/voice:translate-y-0 transition-all duration-150"
          >
            {t('voiceInput')}
          </span>
        </span>

        {showStop ? (
          <button
            type="button"
            onClick={() => onStop?.()}
            aria-label={t('stop')}
            title={t('stop')}
            className="shrink-0 self-end mb-[2px] w-8 h-8 rounded-full flex items-center justify-center bg-white text-[#0B0E14] shadow-[0_2px_10px_rgba(255,255,255,0.18)] hover:shadow-[0_4px_16px_rgba(255,255,255,0.28)] hover:-translate-y-[1px] active:translate-y-0 active:scale-95 cursor-pointer transition-[transform,box-shadow] duration-200"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label={t('send')}
            className={`shrink-0 self-end mb-[2px] w-8 h-8 rounded-full flex items-center justify-center transition-[transform,box-shadow,background-color,color] duration-200 ${
              canSend
                ? 'bg-gradient-to-br from-[#E8C977] via-[#D4B96A] to-[#A88A3D] text-[#0B0E14] shadow-[0_2px_10px_rgba(212,185,106,0.4)] hover:shadow-[0_4px_16px_rgba(212,185,106,0.6)] hover:-translate-y-[1px] active:translate-y-0 active:scale-95 cursor-pointer'
                : 'bg-white/[0.04] text-white/25 cursor-not-allowed'
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
