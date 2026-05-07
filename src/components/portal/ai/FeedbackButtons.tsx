'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { submitFeedback } from '@/lib/ai/client';

interface Props {
  messageId: string;
}

export default function FeedbackButtons({ messageId }: Props) {
  const t = useTranslations('ai');
  const [submitted, setSubmitted] = useState<-1 | 1 | null>(null);
  const [pending, setPending] = useState(false);

  const send = async (rating: -1 | 1) => {
    if (pending || submitted) return;
    setPending(true);
    try {
      await submitFeedback({ message_id: messageId, rating });
      setSubmitted(rating);
    } catch {
      // swallow — user can retry
    } finally {
      setPending(false);
    }
  };

  if (submitted) {
    return (
      <div role="status" className="text-[10px] text-white/40 ms-1">
        {t('feedbackThanks')}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5 -ms-1.5 opacity-60 hover:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={() => send(1)}
        disabled={pending}
        aria-label={t('feedbackHelpful')}
        className="w-7 h-7 rounded-md hover:bg-white/[0.06] active:scale-90 text-white/45 hover:text-[#D4B96A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-150 flex items-center justify-center"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3z" />
          <line x1="7" y1="22" x2="7" y2="11" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => send(-1)}
        disabled={pending}
        aria-label={t('feedbackNotHelpful')}
        className="w-7 h-7 rounded-md hover:bg-white/[0.06] active:scale-90 text-white/45 hover:text-[#F87171] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-150 flex items-center justify-center"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3z" />
          <line x1="17" y1="2" x2="17" y2="13" />
        </svg>
      </button>
    </div>
  );
}
