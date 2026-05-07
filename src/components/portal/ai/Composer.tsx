'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import VoiceButton from './VoiceButton';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function Composer({ onSend, disabled }: Props) {
  const t = useTranslations('ai');
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-t border-white/[0.06] bg-[#0B0E14] px-3 py-2.5"
    >
      <div className="flex items-end gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] focus-within:border-[#BC9C45]/45 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_3px_rgba(188,156,69,0.12)] transition-all px-2.5 py-1.5">
        <VoiceButton />
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={t('askPlaceholder')}
          aria-label={t('askPlaceholder')}
          disabled={disabled}
          className="flex-1 bg-transparent resize-none outline-none text-[13px] text-white placeholder:text-white/30 leading-[1.55] py-1.5 max-h-[140px] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={t('send')}
          className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
            canSend
              ? 'bg-gradient-to-br from-[#E8C977] via-[#D4B96A] to-[#A88A3D] text-[#0B0E14] shadow-[0_2px_8px_rgba(212,185,106,0.4)] hover:shadow-[0_4px_14px_rgba(212,185,106,0.6)] hover:scale-105 active:scale-95 cursor-pointer'
              : 'bg-white/[0.05] text-white/30 cursor-not-allowed'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </form>
  );
}
