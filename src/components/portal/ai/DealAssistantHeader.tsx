'use client';

import { useTranslations } from 'next-intl';
import type { Conversation } from '@/lib/ai/types';
import ThreadSwitcher from './ThreadSwitcher';

interface Props {
  dealName: string | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onSwitchDeal?: () => void;
}

export default function DealAssistantHeader({
  dealName,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  expanded,
  onToggleExpand,
  onClose,
  onSwitchDeal,
}: Props) {
  const t = useTranslations('ai');

  return (
    <header className="relative h-[56px] px-3 flex items-center justify-between border-b border-white/[0.06] bg-[#0F1320]">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#BC9C45]/40 to-transparent" aria-hidden />

      <div className="min-w-0 flex items-center gap-2.5 ps-1">
        <div
          aria-hidden
          className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#E8C977] via-[#D4B96A] to-[#A88A3D] flex items-center justify-center text-[#0B0E14] text-[10px] font-bold shrink-0 shadow-[0_2px_6px_rgba(212,185,106,0.35)]"
        >
          AI
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-white leading-tight truncate">
            {t('title')}
          </div>
          <button
            type="button"
            onClick={onSwitchDeal}
            disabled={!dealName || !onSwitchDeal}
            className="block w-full text-start text-[10px] text-white/45 hover:text-[#D4B96A] disabled:hover:text-white/45 disabled:cursor-not-allowed cursor-pointer truncate transition-colors leading-tight"
            title={dealName ? t('subtitle', { deal: dealName }) : ''}
          >
            {dealName ? t('subtitle', { deal: dealName }) : t('selectDealPrompt')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <ThreadSwitcher
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={onSelectConversation}
          onNew={onNewConversation}
        />
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? t('collapse') : t('expand')}
          className="hidden md:flex w-8 h-8 rounded-lg hover:bg-white/[0.06] active:scale-95 text-white/55 hover:text-white items-center justify-center cursor-pointer transition-all duration-150"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {expanded ? (
              <>
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            ) : (
              <>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            )}
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeAssistant')}
          className="w-8 h-8 rounded-lg hover:bg-[#F87171]/10 active:scale-95 text-white/60 hover:text-[#F87171] flex items-center justify-center cursor-pointer transition-all duration-150"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </header>
  );
}
