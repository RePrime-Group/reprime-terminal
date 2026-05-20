'use client';

import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';

interface Props {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Small confirmation dialog rendered as an overlay inside the assistant panel
 * (absolute inset-0, clipped by the panel's rounded/overflow-hidden frame).
 */
export default function DeleteConversationDialog({ title, onConfirm, onCancel }: Props) {
  const t = useTranslations('ai');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('deleteThreadTitle')}
      onClick={onCancel}
      className="absolute inset-0 z-[60] flex items-center justify-center p-5 bg-black/55 backdrop-blur-[3px] animate-rp-msg-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[300px] rounded-2xl border border-white/[0.1] bg-[#0F1F38] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className="w-9 h-9 rounded-full bg-[#F87171]/[0.12] flex items-center justify-center text-[#F87171] shrink-0">
            <Trash2 size={16} strokeWidth={2} />
          </span>
          <h2 className="text-[14px] font-semibold text-white leading-tight">
            {t('deleteThreadTitle')}
          </h2>
        </div>

        <p className="text-[12px] text-white/55 leading-relaxed mb-4">
          {t('deleteThreadBody', { title: title || t('newThread') })}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-3.5 rounded-lg text-[12px] font-medium text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-8 px-3.5 rounded-lg text-[12px] font-semibold text-white bg-[#F87171] hover:bg-[#ef5d5d] shadow-[0_2px_10px_rgba(248,113,113,0.35)] active:scale-95 cursor-pointer transition-all"
          >
            {t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
