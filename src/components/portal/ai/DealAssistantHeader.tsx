'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Maximize2, Minimize2, PanelRight, PanelLeft, X } from 'lucide-react';
import type { Conversation } from '@/lib/ai/types';
import ThreadSwitcher from './ThreadSwitcher';

interface Props {
  dealName: string | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation?: (conversation: Conversation) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  docked?: boolean;
  onToggleDock?: () => void;
  onClose: () => void;
  onSwitchDeal?: () => void;
}

export default function DealAssistantHeader({
  dealName,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  expanded,
  onToggleExpand,
  docked = false,
  onToggleDock,
  onClose,
  onSwitchDeal,
}: Props) {
  const t = useTranslations('ai');
  const locale = useLocale();
  const isRtl = locale === 'he';
  const DockIcon = isRtl ? PanelLeft : PanelRight;

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
          onDelete={onDeleteConversation}
        />
        {onToggleDock && (
          <button
            type="button"
            onClick={onToggleDock}
            aria-label={docked ? 'Undock sidebar' : 'Dock to side'}
            title={docked ? 'Undock sidebar' : 'Dock to side'}
            className={`hidden md:flex w-8 h-8 rounded-lg active:scale-95 items-center justify-center cursor-pointer transition-all duration-150 ${
              docked
                ? 'bg-[#D4B96A]/15 text-[#E8C977] hover:bg-[#D4B96A]/25'
                : 'hover:bg-white/[0.06] text-white/55 hover:text-white'
            }`}
          >
            <DockIcon size={16} strokeWidth={1.75} />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? t('collapse') : t('expand')}
          className={`${docked ? 'hidden' : 'hidden md:flex'} w-8 h-8 rounded-lg hover:bg-white/[0.06] active:scale-95 text-white/55 hover:text-white items-center justify-center cursor-pointer transition-all duration-150`}
        >
          {expanded ? (
            <Minimize2 size={15} strokeWidth={1.75} />
          ) : (
            <Maximize2 size={15} strokeWidth={1.75} />
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeAssistant')}
          className="w-8 h-8 rounded-lg hover:bg-[#F87171]/10 active:scale-95 text-white/60 hover:text-[#F87171] flex items-center justify-center cursor-pointer transition-all duration-150"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
