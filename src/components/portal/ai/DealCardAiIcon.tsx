'use client';

import { useTranslations } from 'next-intl';
import { useDealAssistantPanel } from './DealAssistantContext';

interface Props {
  dealId: string;
  dealName: string;
}

export default function DealCardAiIcon({ dealId, dealName }: Props) {
  const t = useTranslations('ai');
  const { open } = useDealAssistantPanel();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open({ dealId, dealName });
      }}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label={t('openForDeal', { deal: dealName })}
      title={t('askPill')}
      className="w-7 h-7 rounded-full bg-white/85 backdrop-blur-sm hover:bg-white border border-[#BC9C45]/40 hover:border-[#BC9C45] shadow-md flex items-center justify-center cursor-pointer transition-all"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    </button>
  );
}
