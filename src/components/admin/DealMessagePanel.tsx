'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

export interface ThreadMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_name: string | null;
}

interface DealMessagePanelProps {
  dealId: string;
  onClose: () => void;
  onMessageSent: (msg: ThreadMessage) => void;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Per-deal cache of fetched threads — survives panel close/reopen within the same SPA session.
const threadCache = new Map<string, ThreadMessage[]>();

export default function DealMessagePanel({ dealId, onClose, onMessageSent }: DealMessagePanelProps) {
  const t = useTranslations('admin.dealList');
  const supabase = createClient();
  const [messages, setMessages] = useState<ThreadMessage[]>(() => threadCache.get(dealId) ?? []);
  const [loading, setLoading] = useState(!threadCache.has(dealId));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch the thread (skips network if cached — state already initialized from cache via lazy useState)
  useEffect(() => {
    if (threadCache.has(dealId)) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('terminal_deal_messages')
        .select('id, user_id, message, created_at, terminal_users(full_name)')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      const mapped: ThreadMessage[] = (data ?? []).map((m: {
        id: string;
        user_id: string;
        message: string;
        created_at: string;
        terminal_users: { full_name: string | null } | { full_name: string | null }[] | null;
      }) => {
        const userField = m.terminal_users;
        const fullName = Array.isArray(userField)
          ? userField[0]?.full_name ?? null
          : userField?.full_name ?? null;
        return {
          id: m.id,
          user_id: m.user_id,
          message: m.message,
          created_at: m.created_at,
          user_name: fullName,
        };
      });
      threadCache.set(dealId, mapped);
      setMessages(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId, supabase]);

  // Resolve current user once for sending
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (cancelled || !auth.user) return;
      const { data: row } = await supabase
        .from('terminal_users')
        .select('id, full_name')
        .eq('id', auth.user.id)
        .single();
      if (!cancelled && row) setCurrentUser(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Auto-scroll on open + after new messages
  useEffect(() => {
    if (loading) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [loading, messages.length]);

  // Escape closes the panel
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || sending || !currentUser) return;
    setSending(true);
    const { data, error } = await supabase
      .from('terminal_deal_messages')
      .insert({
        deal_id: dealId,
        user_id: currentUser.id,
        message: trimmed,
      })
      .select('id, user_id, message, created_at')
      .single();
    setSending(false);
    if (error || !data) return;
    const newMsg: ThreadMessage = {
      id: data.id,
      user_id: data.user_id,
      message: data.message,
      created_at: data.created_at,
      user_name: currentUser.full_name,
    };
    const next = [...(threadCache.get(dealId) ?? []), newMsg];
    threadCache.set(dealId, next);
    setMessages(next);
    setInput('');
    onMessageSent(newMsg);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div
      className="border-t border-rp-gray-200 bg-[#FAFBFC]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-rp-gray-200 bg-white">
        <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-rp-gray-500">
          {t('messages')}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closePanel')}
          className="text-rp-gray-400 hover:text-rp-navy transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>
      <div ref={scrollRef} className="max-h-[360px] overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="text-center text-sm text-rp-gray-400 py-6">{t('loadingMessages')}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-rp-gray-400 py-6">{t('noMessages')}</div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-rp-navy/10 text-rp-navy text-xs font-semibold flex items-center justify-center flex-shrink-0">
                  {getInitials(m.user_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-rp-navy">{m.user_name ?? t('unknownUser')}</span>
                    <span className="text-rp-gray-400">{formatStamp(m.created_at)}</span>
                  </div>
                  <p className="text-sm text-rp-gray-700 whitespace-pre-wrap break-words mt-0.5">
                    {m.message}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-rp-gray-200 bg-white px-5 py-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('typeMessage')}
          rows={1}
          className="flex-1 resize-none border border-rp-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors min-h-[40px] max-h-[120px]"
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || sending || !currentUser}
          className="bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 transition-all"
        >
          {t('send')}
        </button>
      </div>
    </div>
  );
}

export function clearThreadCache(dealId: string) {
  threadCache.delete(dealId);
}
