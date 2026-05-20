'use client';

import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
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

  return (
    <article
      ref={refCallback}
      tabIndex={0}
      className={`group flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} animate-rp-msg-in outline-none focus-visible:ring-1 focus-visible:ring-[#BC9C45]/50 rounded-lg`}
      aria-label={isUser ? t('you') : t('assistant')}
    >
      <div className={`flex items-center gap-1.5 max-w-[88%] ${isUser ? 'flex-row-reverse' : ''}`}>
        <div
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
