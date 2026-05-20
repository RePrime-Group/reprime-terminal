'use client';

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Mic } from 'lucide-react';
import { useVoiceInput } from '@/lib/ai/hooks/useVoiceInput';

interface Props {
  onSend: (text: string) => void;
  onStop?: () => void;
  disabled: boolean;
  isStreaming?: boolean;
}

export interface ComposerHandle {
  /** Replace the composer text and focus it (used by "edit message"). */
  setText: (text: string) => void;
}

const MAX_HEIGHT = 160;

const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { onSend, onStop, disabled, isStreaming = false },
  handleRef,
) {
  const t = useTranslations('ai');
  const locale = useLocale();
  const ref = useRef<HTMLTextAreaElement>(null);
  // Only tracks empty vs non-empty so canSend can re-render the send button.
  // The textarea itself is uncontrolled — typing does not trigger React renders.
  const [hasText, setHasText] = useState(false);
  const hasTextRef = useRef(false);
  const resizeRafRef = useRef(0);

  const resize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${next}px`;
    if (el.scrollHeight > MAX_HEIGHT) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const scheduleResize = useCallback(() => {
    if (resizeRafRef.current) return;
    resizeRafRef.current = requestAnimationFrame(() => {
      resizeRafRef.current = 0;
      const el = ref.current;
      if (el) resize(el);
    });
  }, [resize]);

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      // Defer the reflow off the input event. The character is already in the DOM;
      // height catches up on the next frame — invisible at 60fps but keeps the
      // keystroke itself reflow-free, so typing tracks the keyboard exactly.
      scheduleResize();

      const nextHas = el.value.length > 0 && el.value.trimStart().length > 0;
      if (nextHas !== hasTextRef.current) {
        hasTextRef.current = nextHas;
        setHasText(nextHas);
      }
    },
    [scheduleResize],
  );

  // Append a dictated segment to the textarea, spacing it from existing text.
  const appendTranscript = useCallback(
    (text: string) => {
      const el = ref.current;
      if (!el) return;
      const sep = el.value && !/\s$/.test(el.value) ? ' ' : '';
      el.value = el.value + sep + text;
      resize(el);
      if (!hasTextRef.current) {
        hasTextRef.current = true;
        setHasText(true);
      }
      el.focus();
    },
    [resize],
  );

  const { supported: voiceSupported, recording, toggle: toggleVoice, stop: stopVoice } =
    useVoiceInput(locale === 'he' ? 'he-IL' : 'en-US', appendTranscript);

  const submit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const trimmed = el.value.trim();
    if (!trimmed || disabled) return;
    stopVoice(); // stop dictation when the message is sent
    onSend(trimmed);
    el.value = '';
    if (resizeRafRef.current) {
      cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = 0;
    }
    resize(el);
    if (hasTextRef.current) {
      hasTextRef.current = false;
      setHasText(false);
    }
    requestAnimationFrame(() => el.focus());
  }, [disabled, onSend, resize, stopVoice]);

  // Imperative API for "edit message": load text back into the composer.
  useImperativeHandle(
    handleRef,
    () => ({
      setText: (text: string) => {
        const el = ref.current;
        if (!el) return;
        el.value = text;
        resize(el);
        const has = text.trim().length > 0;
        if (has !== hasTextRef.current) {
          hasTextRef.current = has;
          setHasText(has);
        }
        el.focus();
        el.setSelectionRange(text.length, text.length);
      },
    }),
    [resize],
  );

  const canSend = !disabled && hasText;
  const showStop = isStreaming && !!onStop;
  const micDisabled = disabled || !voiceSupported;
  const micLabel = !voiceSupported
    ? t('voiceInputUnsupported')
    : recording
      ? t('stop')
      : t('voiceInput');

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
          defaultValue=""
          onInput={handleInput}
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
            onClick={toggleVoice}
            disabled={micDisabled}
            aria-label={micLabel}
            aria-pressed={recording}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-[transform,box-shadow,background-color,color] duration-200 ${
              recording
                ? 'bg-[#F87171] text-white shadow-[0_2px_10px_rgba(248,113,113,0.5)] active:scale-95 cursor-pointer'
                : micDisabled
                  ? 'bg-white/[0.04] text-white/25 cursor-not-allowed'
                  : 'bg-gradient-to-br from-[#E8C977] via-[#D4B96A] to-[#A88A3D] text-[#0B0E14] shadow-[0_2px_8px_rgba(212,185,106,0.3)] hover:shadow-[0_4px_14px_rgba(212,185,106,0.5)] hover:-translate-y-[1px] active:translate-y-0 active:scale-95 cursor-pointer'
            }`}
          >
            {recording ? (
              <span className="relative flex items-center justify-center gap-[2px] h-[13px]" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="audio-bar w-[2px] h-full rounded-full bg-current origin-center"
                    style={{ animationDelay: `${i * 0.14}s`, animationDuration: '0.7s' }}
                  />
                ))}
              </span>
            ) : (
              <Mic size={14} strokeWidth={2} className="relative" />
            )}
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full mb-2 end-0 px-2 py-1 rounded-md bg-[#1a1f2e] border border-white/[0.08] text-white/85 text-[10px] font-medium whitespace-nowrap shadow-[0_4px_14px_rgba(0,0,0,0.45)] opacity-0 translate-y-1 group-hover/voice:opacity-100 group-hover/voice:translate-y-0 transition-all duration-150"
          >
            {micLabel}
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
});

export default Composer;
