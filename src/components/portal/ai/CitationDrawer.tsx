'use client';

import { useTranslations } from 'next-intl';
import type { Citation } from '@/lib/ai/types';

interface Props {
  citation: Citation | null;
  onClose: () => void;
}

export default function CitationDrawer({ citation, onClose }: Props) {
  const t = useTranslations('ai');
  if (!citation) return null;

  const isDocument = citation.kind === 'document';

  return (
    <aside
      role="dialog"
      aria-label={t('sourceDrawerTitle')}
      className="absolute inset-y-0 end-full w-[360px] max-w-[calc(100vw-32px)] bg-[#0B0E14] border-s border-white/[0.06] shadow-[-12px_0_36px_rgba(0,0,0,0.35)] flex flex-col"
    >
      <header className="h-[56px] px-4 flex items-center justify-between border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[1.5px] uppercase text-[#BC9C45]">
            {t('sourceDrawerTitle')}
          </div>
          <div className="text-[13px] font-medium text-white truncate">{citation.label}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeSource')}
          className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/60 hover:text-white cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {isDocument ? (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] aspect-[3/4] flex flex-col items-center justify-center text-center px-6 gap-3">
            <div className="w-12 h-12 rounded-md bg-[#BC9C45]/15 border border-[#BC9C45]/30 flex items-center justify-center text-[#D4B96A] text-lg">
              📄
            </div>
            <div className="text-[12px] text-white/80">
              {t('placeholderPdfPage', {
                page: citation.page ?? 1,
                document: citation.label,
              })}
            </div>
            <div className="text-[10px] text-white/40 leading-relaxed">
              {t('placeholderPdf')}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-5 space-y-2">
            <div className="text-[10px] font-semibold tracking-[1.5px] uppercase text-white/50">
              {citation.kind}
            </div>
            <div className="text-[14px] text-white">{citation.label}</div>
          </div>
        )}
      </div>
    </aside>
  );
}
