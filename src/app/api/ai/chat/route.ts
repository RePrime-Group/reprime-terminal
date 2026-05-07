import { NextRequest, NextResponse, after } from 'next/server';
import type { ChatRequest, ChatResponse, Message } from '@/lib/ai/types';
import { isAssistantEnabled, jsonError, serviceDisabled } from '../_runtime';
import { callN8n, getAuthedSession, unwrapMessageContent } from '../_n8n';
import { generateAndSaveConversationTitle } from '@/lib/ai/title';

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
