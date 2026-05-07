'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { DealAssistantProvider, useDealAssistantPanel } from './DealAssistantContext';
import DealAssistantPanel from './DealAssistantPanel';

function dealIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/portal\/deals\/([^/?#]+)/);
  return match ? match[1] : null;
}

function GlobalShortcut() {
  const { isOpen, open, close } = useDealAssistantPanel();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!isToggle) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      if (isOpen) {
        close();
        return;
      }
      const dealId = dealIdFromPath(pathname ?? '');
      if (!dealId) return;
      const el = document.querySelector<HTMLElement>('[data-deal-name]');
      open({ dealId, dealName: el?.dataset.dealName });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, open, close, pathname]);

  return null;
}

function PanelMount() {
  const { dealId } = useDealAssistantPanel();
  return <DealAssistantPanel key={dealId ?? 'none'} />;
}

export default function AssistantHost({ children }: { children: React.ReactNode }) {
  return (
    <DealAssistantProvider>
      {children}
      <PanelMount />
      <GlobalShortcut />
    </DealAssistantProvider>
  );
}
