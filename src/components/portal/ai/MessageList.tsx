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
          className="flex items-center gap-2 text-[12px] text-white/55"
        >
          <span className="inline-flex gap-1" aria-hidden>
            <span className="w-1.5 h-1.5 rounded-full bg-[#BC9C45] animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#BC9C45] animate-pulse [animation-delay:120ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#BC9C45] animate-pulse [animation-delay:240ms]" />
          </span>
          <span>{t(statusText as 'thinking')}</span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
