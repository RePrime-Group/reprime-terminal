'use client';

import { type RefObject } from 'react';
import { useDealAssistantPanelOptional } from '@/components/portal/ai/DealAssistantContext';
import type { TabKey } from './types';

interface TabDef {
  key: TabKey;
  label: string;
  enabled: boolean;
}

interface Props {
  tabs: TabDef[];
  activeTab: TabKey;
  ndaSigned: boolean;
  dealId: string;
  dealName: string;
  tabBarRef: RefObject<HTMLDivElement | null>;
  setShowNDAModal: (v: boolean) => void;
  setActiveTab: (k: TabKey) => void;
}

export function TabBar({ tabs, activeTab, ndaSigned, dealId, dealName, tabBarRef, setShowNDAModal, setActiveTab }: Props) {
  const assistantPanel = useDealAssistantPanelOptional();
  return (
    <div ref={tabBarRef} className="px-4 md:px-8 mt-6 md:mt-8">
      <div className="flex flex-wrap justify-center gap-2 md:gap-2.5 pb-2">
        {tabs.filter((tab) => tab.enabled).map((tab) => {
          const isActive = activeTab === tab.key;
          const isLocked = (tab.key === 'due-diligence' || tab.key === 'photos') && !ndaSigned;
          return (
            <button
              key={tab.key}
              onClick={() => {
                if (isLocked) {
                  setShowNDAModal(true);
                  return;
                }
                if (tab.key === 'assistant') {
                  assistantPanel?.open({ dealId, dealName });
                  return;
                }
                setActiveTab(tab.key);
              }}
              className={`relative px-5 md:px-6 py-3 rounded-lg text-[16px] md:text-[17px] font-semibold transition-all inline-flex items-center gap-2 whitespace-nowrap border-2 ${
                isActive
                  ? 'border-[#BC9C45] bg-[#FDF8ED] text-[#0E3470] shadow-[0_2px_8px_rgba(188,156,69,0.18)]'
                  : 'border-[#EEF0F4] bg-white text-[#6B7280] hover:border-[#BC9C45]/60 hover:text-[#0E3470] hover:bg-[#FDF8ED]/50'
              }`}
            >
              {tab.label}
              {isLocked && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
