'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listConversations } from '../client';
import type { Conversation } from '../types';

export function useConversationHistory(dealId: string, enabled = true) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const data = await listConversations(dealId, ctrl.signal);
      setConversations(data.conversations);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    return () => abortRef.current?.abort();
  }, [enabled, refresh]);

  return { conversations, loading, error, refresh };
}
