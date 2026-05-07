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

export interface PreviewMessage {
  message: string;
  created_at: string;
  author_name: string | null;
}

interface DealMessagePanelProps {
  dealId: string;
  onClose: () => void;
  onLatestMessageChange: (latest: PreviewMessage | null) => void;
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

function previewFrom(messages: ThreadMessage[]): PreviewMessage | null {
  if (messages.length === 0) return null;
  const last = messages[messages.length - 1];
  return {
    message: last.message,
    created_at: last.created_at,
    author_name: last.user_name,
  };
}

// Per-deal cache of fetched threads — survives panel close/reopen within the same SPA session.
const threadCache = new Map<string, ThreadMessage[]>();

export default function DealMessagePanel({
  dealId,
  onClose,
  onLatestMessageChange,
}: DealMessagePanelProps) {
  const t = useTranslations('admin.dealList');
  const tc = useTranslations('common');
  const supabase = createClient();
  const [messages, setMessages] = useState<ThreadMessage[]>(() => threadCache.get(dealId) ?? []);
  const [loading, setLoading] = useState(!threadCache.has(dealId));
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string | null } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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

  // Auto-scroll on open + after new messages (but not during edit, which would yank focus)
  useEffect(() => {
    if (loading || editingId) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [loading, editingId, messages.length]);

  // Escape closes the panel (or cancels an active edit/confirm first)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (confirmDeleteId) {
        setConfirmDeleteId(null);
        return;
      }
      if (editingId) {
        setEditingId(null);
        setEditDraft('');
        return;
      }
      onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editingId, confirmDeleteId]);

  function commitMessages(next: ThreadMessage[]) {
    threadCache.set(dealId, next);
    setMessages(next);
    onLatestMessageChange(previewFrom(next));
  }

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
    commitMessages([...(threadCache.get(dealId) ?? []), newMsg]);
    setInput('');
  }

  function startEdit(msg: ThreadMessage) {
    setEditingId(msg.id);
    setEditDraft(msg.message);
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft('');
  }

  async function saveEdit(msg: ThreadMessage) {
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === msg.message) {
      cancelEdit();
      return;
    }
    const { error } = await supabase
      .from('terminal_deal_messages')
      .update({ message: trimmed })
      .eq('id', msg.id);
    if (error) return;
    const current = threadCache.get(dealId) ?? messages;
    const next = current.map((m) => (m.id === msg.id ? { ...m, message: trimmed } : m));
    commitMessages(next);
    cancelEdit();
  }

  async function performDelete(msg: ThreadMessage) {
    const { error } = await supabase
      .from('terminal_deal_messages')
      .delete()
      .eq('id', msg.id);
    if (error) return;
    const current = threadCache.get(dealId) ?? messages;
    const next = current.filter((m) => m.id !== msg.id);
    commitMessages(next);
    setConfirmDeleteId(null);
  }

  function onSendKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function onEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, msg: ThreadMessage) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void saveEdit(msg);
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
            {messages.map((m) => {
              const isOwn = currentUser?.id === m.user_id;
              const isEditing = editingId === m.id;
              const isConfirming = confirmDeleteId === m.id;
              return (
                <li key={m.id} className="flex gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-rp-navy/10 text-rp-navy text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {getInitials(m.user_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-rp-navy">
                        {m.user_name ?? t('unknownUser')}
                      </span>
                      <span className="text-rp-gray-400">{formatStamp(m.created_at)}</span>
                      {isOwn && !isEditing && !isConfirming && (
                        <span className="ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            className="text-rp-gray-500 hover:text-rp-navy transition-colors"
                          >
                            {tc('edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(m.id);
                              setEditingId(null);
                            }}
                            className="text-rp-gray-500 hover:text-red-600 transition-colors"
                          >
                            {tc('delete')}
                          </button>
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="mt-1 space-y-2">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onKeyDown={(e) => onEditKeyDown(e, m)}
                          rows={Math.min(6, Math.max(1, editDraft.split('\n').length))}
                          autoFocus
                          className="w-full resize-none border border-rp-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEdit(m)}
                            disabled={!editDraft.trim() || editDraft.trim() === m.message}
                            className="bg-rp-navy text-white px-3 py-1 rounded-md text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rp-navy/90 transition-colors"
                          >
                            {tc('save')}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-rp-gray-600 px-3 py-1 rounded-md text-xs font-semibold hover:bg-rp-gray-100 transition-colors"
                          >
                            {tc('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-rp-gray-700 whitespace-pre-wrap break-words mt-0.5">
                        {m.message}
                      </p>
                    )}
                    {isConfirming && !isEditing && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-rp-gray-600">{tc('confirmDelete')}</span>
                        <button
                          type="button"
                          onClick={() => void performDelete(m)}
                          className="bg-red-600 text-white px-3 py-1 rounded-md font-semibold hover:bg-red-700 transition-colors"
                        >
                          {tc('delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-rp-gray-600 px-3 py-1 rounded-md font-semibold hover:bg-rp-gray-100 transition-colors"
                        >
                          {tc('cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-rp-gray-200 bg-white px-5 py-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onSendKeyDown}
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
