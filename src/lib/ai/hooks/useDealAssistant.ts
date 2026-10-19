'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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

export function useDealAssistant(dealId: string) {
  const t = useTranslations('ai');
  const locale = useLocale();
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

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (rotationRef.current) clearInterval(rotationRef.current);
    setState((s) => ({
      ...s,
      status: 'idle',
      statusText: null,
      error: null,
    }));
  }, []);

  // The API's error messages are English-only; show them in the user's
  // language by error code instead.
  const errorText = useCallback(
    (err: unknown): string => {
      if (err instanceof AiClientError) {
        if (err.status === 504) return t('errorTimeout');
        switch (err.code) {
          case 'forbidden':
            return t('errorForbidden');
          case 'unauthorized':
            return t('errorUnauthorized');
          case 'not_found':
            return t('errorNotFound');
          case 'service_disabled':
            return t('disabledNotice');
          case 'upstream_error':
            return t('errorUpstream');
        }
      }
      return t('errorGeneric');
    },
    [t],
  );

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
      setState((s) => ({ ...s, status: 'error', error: errorText(err) }));
    }
  }, [errorText]);

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

      const statusRotation = t.raw('statusRotation') as string[];

      setState((s) => ({
        ...s,
        messages: [...s.messages, optimistic],
        status: 'sending',
        statusText: statusRotation[0],
        error: null,
      }));

      let i = 0;
      if (rotationRef.current) clearInterval(rotationRef.current);
      rotationRef.current = setInterval(() => {
        i = (i + 1) % statusRotation.length;
        setState((s) =>
          s.status === 'sending' ? { ...s, statusText: statusRotation[i] } : s,
        );
      }, 1500);

      try {
        const res = await sendMessage(
          {
            deal_id: dealId,
            conversation_id: state.conversationId ?? undefined,
            message: trimmed,
            locale: locale === 'he' ? 'he' : 'en',
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
        setState((s) => ({
          ...s,
          messages: s.messages.filter((m) => m.id !== optimistic.id),
          status: 'error',
          statusText: null,
          error: errorText(err),
        }));
      }
    },
    [dealId, state.conversationId, t, locale, errorText],
  );

  return {
    ...state,
    send,
    loadConversation,
    reset,
    stop,
  };
}
