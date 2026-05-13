import { NextRequest, NextResponse, after } from 'next/server';
import type { Citation, ChatRequest, ChatResponse, Message } from '@/lib/ai/types';
import { isAssistantEnabled, jsonError, serviceDisabled } from '../_runtime';
import { callN8n, getAuthedSession, unwrapMessageContent } from '../_n8n';
import { generateAndSaveConversationTitle } from '@/lib/ai/title';
import { createAdminClient } from '@/lib/supabase/admin';

// Matches full UUID `(uuid)` or short prefix `(abcdef12)` — Phase 6 simplified
// the marker by dropping the optional page suffix. The short-prefix form is a
// fallback for when the agent abbreviates; we resolve it by looking up any
// document whose id starts with that prefix.
const CITE_RE = /\(([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{8,})\)/gi;

async function extractDocumentCitations(content: string, dealId: string): Promise<Citation[]> {
  const refs: string[] = [];
  for (const m of content.matchAll(CITE_RE)) {
    refs.push(m[1].toLowerCase());
  }
  if (refs.length === 0) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from('terminal_dd_documents')
    .select('id,name,display_name')
    .eq('deal_id', dealId);
  const docs = (data ?? []) as { id: string; name: string | null; display_name: string | null }[];

  const resolve = (ref: string): { id: string; label: string } | null => {
    const exact = docs.find((d) => d.id === ref);
    if (exact) return { id: exact.id, label: exact.display_name || exact.name || exact.id };
    const prefix = docs.find((d) => d.id.startsWith(ref));
    return prefix ? { id: prefix.id, label: prefix.display_name || prefix.name || prefix.id } : null;
  };

  const seen = new Map<string, Citation>();
  for (const ref of refs) {
    const resolved = resolve(ref);
    if (!resolved) continue;
    if (!seen.has(resolved.id)) {
      seen.set(resolved.id, { id: resolved.id, kind: 'document', label: resolved.label, document_id: resolved.id });
    }
  }
  return Array.from(seen.values());
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isAssistantEnabled()) return serviceDisabled();

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return jsonError('bad_request', 'Invalid JSON body.', 400);
  }

  if (!body.deal_id || !body.message?.trim()) {
    return jsonError('bad_request', 'deal_id and message are required.', 400);
  }

  const session = await getAuthedSession();
  if (!session) return jsonError('unauthorized', 'Sign in required.', 401);

  const result = await callN8n<{
    conversation_id?: string;
    message?: string | Message;
    message_id?: string;
    citations?: Message['citations'];
  }>(
    'N8N_WEBHOOK_PATH_CHAT',
    {
      user_id: session.userId,
      deal_id: body.deal_id,
      conversation_id: body.conversation_id ?? null,
      message: body.message.trim(),
    },
    session,
  );

  if (!result.ok) return jsonError(result.code, result.message, result.status);
  const raw = result.data;

  if (!raw.conversation_id || raw.message === undefined) {
    return jsonError('upstream_error', 'Malformed upstream response.', 502);
  }

  const message: Message =
    typeof raw.message === 'string'
      ? {
          id: raw.message_id ?? `msg-${Date.now().toString(36)}`,
          role: 'assistant',
          content: unwrapMessageContent(raw.message),
          citations: raw.citations ?? [],
          created_at: new Date().toISOString(),
        }
      : { ...raw.message, content: unwrapMessageContent(raw.message.content) };

  if (!message.citations || message.citations.length === 0) {
    message.citations = await extractDocumentCitations(message.content, body.deal_id);
  }
  if (message.citations && message.citations.length > 0) {
    // Strip the now-redundant inline (uuid[, page]) markers; the chips below
    // the message convey the same information visually.
    message.content = message.content
      .replace(CITE_RE, '')
      .replace(/[ \t]+([.,;:!?])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }

  const payload: ChatResponse = { conversation_id: raw.conversation_id, message };

  // First turn of a new conversation: generate a real title via Haiku in the
  // background so the sidebar does not stay stuck on the truncated user message.
  if (!body.conversation_id && message.content) {
    after(
      generateAndSaveConversationTitle({
        conversationId: raw.conversation_id,
        userMessage: body.message.trim(),
        assistantMessage: message.content,
      }),
    );
  }

  return NextResponse.json(payload);
}
