'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { Citation, Message } from '@/lib/ai/types';
import MessageBubble from './MessageBubble';

interface Props {
  messages: Message[];
  onOpenCitation: (citation: Citation) => void;
  statusText: string | null;
  freshAssistantId?: string | null;
  messageRefsCallback?: (el: HTMLElement | null, idx: number) => void;
}

export default function MessageList({
  messages,
  onOpenCitation,
  statusText,
  freshAssistantId = null,
  messageRefsCallback,
}: Props) {
  const t = useTranslations('ai');
  const endRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.id !== lastIdRef.current) {
      lastIdRef.current = last.id;
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label={t('messages')}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5"
    >
      {messages.map((m, idx) => (
        <MessageBubble
          key={m.id}
          message={m}
          onOpenCitation={onOpenCitation}
          stream={!!freshAssistantId && m.id === freshAssistantId}
          refCallback={messageRefsCallback ? (el) => messageRefsCallback(el, idx) : undefined}
        />
      ))}

      {statusText && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 text-[12px] text-white/60"
        >
          <span className="ai-sparkle" aria-hidden>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2 L13.6 10.4 L22 12 L13.6 13.6 L12 22 L10.4 13.6 L2 12 L10.4 10.4 Z"
                fill="#BC9C45"
              />
            </svg>
          </span>
          <span className="ai-status-text">{statusText}</span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
