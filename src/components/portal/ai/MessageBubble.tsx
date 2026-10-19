'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Pencil } from 'lucide-react';
import type { Citation, Message } from '@/lib/ai/types';
import CitationChip from './CitationChip';
import Markdown from './Markdown';

interface Props {
  message: Message;
  onOpenCitation: (citation: Citation) => void;
  stream?: boolean;
  refCallback?: (el: HTMLElement | null) => void;
  onEdit?: (content: string) => void;
}

export default function MessageBubble({ message, onOpenCitation, stream = false, refCallback, onEdit }: Props) {
  const t = useTranslations('ai');
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const canEdit = isUser && !!onEdit;

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  // Copies the raw markdown rather than the rendered text, so a table or a
  // bullet list survives being pasted somewhere else. Citation markers are
  // already stripped from `content` by the chat route.
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      // Clipboard is unavailable in insecure contexts and can be denied by
      // permission. Say nothing rather than show a tick for a copy that did
      // not happen.
      return;
    }
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <article
      ref={refCallback}
      tabIndex={0}
      className={`group flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} animate-rp-msg-in outline-none focus-visible:ring-1 focus-visible:ring-[#BC9C45]/50 rounded-lg`}
      aria-label={isUser ? t('you') : t('assistant')}
    >
      <div className={`flex items-center gap-1.5 max-w-[88%] ${isUser ? 'flex-row-reverse' : ''}`}>
        <div
          // Per-message direction: a Hebrew reply renders RTL even on an `en`
          // portal (and vice versa), since the assistant follows the language
          // the user wrote in, not the page locale.
          dir="auto"
          className={`rounded-2xl px-4 py-2.5 text-[15px] leading-[1.6] break-words ${
            isUser
              ? 'bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] text-white shadow-[0_2px_8px_rgba(188,156,69,0.25)] whitespace-pre-wrap'
              : 'bg-black/40 backdrop-blur-2xl  border border-[#BC9C45]/40 text-white/90'
          }`}
        >
          {isAssistant ? (
            <div className={stream ? 'rp-reveal' : undefined}>
              <Markdown>{message.content}</Markdown>
            </div>
          ) : (
            message.content
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? t('copied') : t('copyMessage')}
          title={copied ? t('copied') : t('copyMessage')}
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-150"
        >
          {copied ? (
            <Check size={13} strokeWidth={2.2} className="text-[#4ADE80]" />
          ) : (
            <Copy size={13} strokeWidth={1.9} />
          )}
        </button>

        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit!(message.content)}
            aria-label={t('editMessage')}
            title={t('editMessage')}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-150"
          >
            <Pencil size={13} strokeWidth={1.9} />
          </button>
        )}
      </div>

      {isAssistant && message.citations && message.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-[88%]">
          {message.citations.map((c) => (
            <CitationChip key={c.id} citation={c} onOpen={onOpenCitation} />
          ))}
        </div>
      )}

    </article>
  );
}
