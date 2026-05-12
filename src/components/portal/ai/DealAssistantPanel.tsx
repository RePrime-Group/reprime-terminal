'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Citation } from '@/lib/ai/types';
import { useDealAssistant } from '@/lib/ai/hooks/useDealAssistant';
import { useConversationHistory } from '@/lib/ai/hooks/useConversationHistory';
import DealAssistantHeader from './DealAssistantHeader';
import MessageList from './MessageList';
import Composer from './Composer';
import SuggestedPrompts from './SuggestedPrompts';
import CitationDrawer from './CitationDrawer';
import DealPicker from './DealPicker';
import { useDealAssistantPanel } from './DealAssistantContext';

type PanelSize = 'compact' | 'expanded';

export default function DealAssistantPanel() {
  const t = useTranslations('ai');
  const locale = useLocale();
  const isRtl = locale === 'he';
  const { isOpen, dealId, dealName, close, setDeal } = useDealAssistantPanel();

  const [size, setSize] = useState<PanelSize>('compact');
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<(HTMLElement | null)[]>([]);
  const [focusedMessageIdx, setFocusedMessageIdx] = useState<number | null>(null);
  const [lastAttempt, setLastAttempt] = useState<string | null>(null);

  const {
    messages,
    status,
    statusText,
    send,
    conversationId,
    loadConversation,
    reset,
    stop,
    error,
    freshAssistantId,
  } = useDealAssistant(dealId ?? '');
  const { conversations, refresh: refreshHistory } = useConversationHistory(
    dealId ?? '',
    !!dealId && isOpen,
  );

  // Focus trap: keep Tab/Shift+Tab inside the panel while open.
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;

    const FOCUSABLE =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }

      // ↑ / ↓ — traverse messages when focus is inside the panel
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = messageRefs.current.filter(Boolean) as HTMLElement[];
        if (items.length === 0) return;
        e.preventDefault();
        const current = focusedMessageIdx ?? (e.key === 'ArrowDown' ? -1 : items.length);
        const next =
          e.key === 'ArrowDown'
            ? Math.min(current + 1, items.length - 1)
            : Math.max(current - 1, 0);
        items[next]?.focus();
        setFocusedMessageIdx(next);
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.closest('[aria-hidden="true"]'),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close, focusedMessageIdx]);

  // Move initial focus into the panel when it opens.
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
    setFocusedMessageIdx(null);
  }, [isOpen]);

  const handleSend = useCallback(
    (text: string) => {
      setLastAttempt(text);
      send(text).then(() => refreshHistory());
    },
    [send, refreshHistory],
  );

  // Clear the retry target once a send succeeds (status returns to idle with no error).
  useEffect(() => {
    if (status === 'idle' && !error && lastAttempt !== null) {
      setLastAttempt(null);
    }
  }, [status, error, lastAttempt]);

  if (!isOpen) return null;

  const compact = size === 'compact';
  const sideClass = isRtl ? 'left-4 md:left-5' : 'right-4 md:right-5';

  const compactBox =
    'w-[min(calc(100vw-32px),380px)] h-[min(calc(100dvh-120px),580px)]';
  const expandedBox =
    'w-[min(calc(100vw-32px),720px)] h-[min(calc(100dvh-100px),760px)]';
  const sizeClass = compact ? compactBox : expandedBox;

  const animClass = isRtl ? 'animate-rp-bubble-in-left' : 'animate-rp-bubble-in';

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('title')}
      aria-modal={false}
      className={`fixed bottom-[88px] ${sideClass} ${sizeClass} ${animClass} z-[55] bg-[#0B0E14] text-white rounded-2xl border border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.55),0_2px_8px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden`}
      style={{ transition: 'width 220ms ease-out, height 220ms ease-out' }}
    >
      <DealAssistantHeader
        dealName={dealName}
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectConversation={loadConversation}
        onNewConversation={reset}
        expanded={!compact}
        onToggleExpand={() => setSize((s) => (s === 'compact' ? 'expanded' : 'compact'))}
        onClose={close}
        onSwitchDeal={() => setDeal(null)}
      />

      {!dealId ? (
        <DealPicker
          onSelect={(id, name) => {
            setDeal(id, name);
          }}
        />
      ) : messages.length === 0 ? (
        <div className="flex-1 overflow-y-auto">
          <SuggestedPrompts dealName={dealName} onPick={handleSend} />
        </div>
      ) : (
        <MessageList
          messages={messages}
          onOpenCitation={setActiveCitation}
          statusText={statusText}
          freshAssistantId={freshAssistantId}
          messageRefsCallback={(el, idx) => { messageRefs.current[idx] = el; }}
        />
      )}

      {error && (
        <div
          role="alert"
          className="px-4 py-2 text-[11px] text-[#F87171] border-t border-white/[0.06] bg-[#F87171]/[0.05] flex items-center gap-2"
        >
          <span className="flex-1 min-w-0">{error}</span>
          {lastAttempt && (
            <button
              type="button"
              onClick={() => handleSend(lastAttempt)}
              disabled={status === 'sending' || status === 'loading'}
              aria-label={t('retry') ?? 'Retry'}
              title={t('retry') ?? 'Retry'}
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[#F87171]/80 hover:text-[#F87171] hover:bg-[#F87171]/[0.1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
        </div>
      )}

      {dealId && (
        <Composer
          onSend={handleSend}
          onStop={stop}
          disabled={status === 'sending' || status === 'loading'}
          isStreaming={status === 'sending'}
        />
      )}

      <CitationDrawer citation={activeCitation} onClose={() => setActiveCitation(null)} />
    </div>
  );
}
