'use client';

import { useTranslations } from 'next-intl';
import type { Citation, Message } from '@/lib/ai/types';
import CitationChip from './CitationChip';
import Markdown from './Markdown';

interface Props {
  message: Message;
  onOpenCitation: (citation: Citation) => void;
  stream?: boolean;
  refCallback?: (el: HTMLElement | null) => void;
}

export default function MessageBubble({ message, onOpenCitation, stream = false, refCallback }: Props) {
  const t = useTranslations('ai');
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <article
      ref={refCallback}
      tabIndex={0}
      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} animate-rp-msg-in outline-none focus-visible:ring-1 focus-visible:ring-[#BC9C45]/50 rounded-lg`}
      aria-label={isUser ? t('you') : t('assistant')}
    >
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[13px] leading-[1.55] break-words ${
          isUser
            ? 'bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] text-white shadow-[0_2px_8px_rgba(188,156,69,0.25)] whitespace-pre-wrap'
            : 'bg-white/[0.04] border border-white/[0.06] text-white/90'
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
