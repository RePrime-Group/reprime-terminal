'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AiClientError, getConversation, sendMessage } from '../client';
import type { Message } from '../types';

export interface UseDealAssistantState {
  conversationId: string | null;
  messages: Message[];
  status: 'idle' | 'loading' | 'sending' | 'error';
  statusText: string | null;
  error: string | null;
  freshAssistantId: string | null;
}

const STATUS_ROTATION = [
  'thinking',
  'lookingUp',
  'computing',
  'draftingResponse',
  'polishingProse',
  'checkingFacts',
  'finishingTouches',
  'synthesizingData',
  'runningSimulations',
  'mappingLogic',
  'identifyingPatterns',
] as const;

export function useDealAssistant(dealId: string) {
  const [state, setState] = useState<UseDealAssistantState>({
    conversationId: null,
    messages: [],
    status: 'idle',
    statusText: null,
    error: null,
    freshAssistantId: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const rotationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (rotationRef.current) clearInterval(rotationRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (rotationRef.current) clearInterval(rotationRef.current);
    setState({
      conversationId: null,
      messages: [],
      status: 'idle',
      statusText: null,
      error: null,
      freshAssistantId: null,
    });
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const data = await getConversation(conversationId, ctrl.signal);
      setState({
        conversationId: data.conversation.id,
        messages: data.messages,
        status: 'idle',
        statusText: null,
        error: null,
        freshAssistantId: null,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Failed to load conversation';
      setState((s) => ({ ...s, status: 'error', error: message }));
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const optimistic: Message = {
        id: `pending-${Date.now()}`,
        role: 'user',
        content: trimmed,
        created_at: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        messages: [...s.messages, optimistic],
        status: 'sending',
        statusText: STATUS_ROTATION[0],
        error: null,
      }));

      let i = 0;
      if (rotationRef.current) clearInterval(rotationRef.current);
      rotationRef.current = setInterval(() => {
        i = (i + 1) % STATUS_ROTATION.length;
        setState((s) =>
          s.status === 'sending' ? { ...s, statusText: STATUS_ROTATION[i] } : s,
        );
      }, 1500);

      try {
        const res = await sendMessage(
          {
            deal_id: dealId,
            conversation_id: state.conversationId ?? undefined,
            message: trimmed,
          },
          ctrl.signal,
        );
        if (rotationRef.current) clearInterval(rotationRef.current);
        setState((s) => ({
          conversationId: res.conversation_id,
          messages: [...s.messages, res.message],
          status: 'idle',
          statusText: null,
          error: null,
          freshAssistantId: res.message.id,
        }));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (rotationRef.current) clearInterval(rotationRef.current);
        const message =
          err instanceof AiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to send message';
        setState((s) => ({
          ...s,
          messages: s.messages.filter((m) => m.id !== optimistic.id),
          status: 'error',
          statusText: null,
          error: message,
        }));
      }
    },
    [dealId, state.conversationId],
  );

  return {
    ...state,
    send,
    loadConversation,
    reset,
  };
}
