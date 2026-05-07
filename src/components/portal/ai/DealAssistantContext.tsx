'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface OpenOptions {
  dealId: string | null;
  dealName?: string;
}

interface ContextValue {
  isOpen: boolean;
  dealId: string | null;
  dealName: string | null;
  open: (options: OpenOptions) => void;
  setDeal: (dealId: string | null, dealName?: string) => void;
  close: () => void;
}

const DealAssistantContext = createContext<ContextValue | null>(null);

export function DealAssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dealId, setDealId] = useState<string | null>(null);
  const [dealName, setDealName] = useState<string | null>(null);

  const open = useCallback(({ dealId: id, dealName: name }: OpenOptions) => {
    setDealId(id);
    setDealName(name ?? null);
    setIsOpen(true);
  }, []);

  const setDeal = useCallback((id: string | null, name?: string) => {
    setDealId(id);
    setDealName(name ?? null);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<ContextValue>(
    () => ({ isOpen, dealId, dealName, open, setDeal, close }),
    [isOpen, dealId, dealName, open, setDeal, close],
  );

  return (
    <DealAssistantContext.Provider value={value}>
      {children}
    </DealAssistantContext.Provider>
  );
}

export function useDealAssistantPanel(): ContextValue {
  const ctx = useContext(DealAssistantContext);
  if (!ctx) {
    throw new Error('useDealAssistantPanel must be used inside DealAssistantProvider');
  }
  return ctx;
}

export function useDealAssistantPanelOptional(): ContextValue | null {
  return useContext(DealAssistantContext);
}
