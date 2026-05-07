'use client';

import { useTranslations } from 'next-intl';

export default function VoiceButton() {
  const t = useTranslations('ai');
  return (
    <button
      type="button"
      disabled
      title={t('voiceInput')}
      aria-label={t('voiceInput')}
      className="w-9 h-9 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/35 cursor-not-allowed flex items-center justify-center"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}
