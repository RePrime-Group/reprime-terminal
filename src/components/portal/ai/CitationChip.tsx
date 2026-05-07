'use client';

import { useTranslations } from 'next-intl';
import type { Citation } from '@/lib/ai/types';

interface Props {
  citation: Citation;
  onOpen: (citation: Citation) => void;
}

const KIND_GLYPH: Record<Citation['kind'], string> = {
  document: '📄',
  tenant: '◉',
  deal_field: '◆',
  computed: 'ƒ',
};

export default function CitationChip({ citation, onOpen }: Props) {
  const t = useTranslations('ai');
  return (
    <button
      type="button"
      onClick={() => onOpen(citation)}
      aria-label={`${t('viewSource')}: ${citation.label}`}
      className="group inline-flex items-center gap-1.5 max-w-full px-2 py-[3px] rounded-md border border-[#BC9C45]/30 bg-[#BC9C45]/[0.08] text-[10.5px] font-medium text-[#D4B96A] hover:bg-[#BC9C45]/15 hover:border-[#BC9C45]/55 hover:-translate-y-[1px] active:translate-y-0 cursor-pointer transition-all duration-150"
    >
      <span aria-hidden className="text-[9px] opacity-80 group-hover:opacity-100 transition-opacity">
        {KIND_GLYPH[citation.kind]}
      </span>
      <span className="truncate">{citation.label}</span>
    </button>
  );
}
