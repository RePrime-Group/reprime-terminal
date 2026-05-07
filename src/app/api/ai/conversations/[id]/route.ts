import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Conversation, GetConversationResponse, Message } from '@/lib/ai/types';
import { isAssistantEnabled, jsonError, serviceDisabled } from '../../_runtime';
import { unwrapMessageContent } from '../../_n8n';

export const maxDuration = 10;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAssistantEnabled()) return serviceDisabled();

  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError('unauthorized', 'Sign in required.', 401);

  const { data: convRow, error: convErr } = await supabase
    .from('terminal_ai_conversations')
    .select('id, deal_id, title, updated_at, created_at, user_id')
    .eq('id', id)
    .single();

  if (convErr || !convRow) return jsonError('not_found', 'Conversation not found.', 404);
  if (convRow.user_id !== user.id) {
    return jsonError('forbidden', 'You do not have access to this conversation.', 403);
  }

  const { data: msgRows, error: msgErr } = await supabase
    .from('terminal_ai_messages')
    .select('id, role, content, citations, tool_calls, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  if (msgErr) return jsonError('internal', msgErr.message, 500);

  const messages: Message[] = (msgRows ?? []).map((row) => ({
    id: row.id,
    role: (row.role ?? 'assistant') as Message['role'],
    content: unwrapMessageContent(row.content),
    citations: Array.isArray(row.citations) ? (row.citations as Message['citations']) : [],
    tool_calls: Array.isArray(row.tool_calls) ? (row.tool_calls as Message['tool_calls']) : undefined,
    created_at: row.created_at ?? new Date().toISOString(),
  }));

  const conversation: Conversation = {
    id: convRow.id,
    deal_id: convRow.deal_id,
    title: convRow.title ?? '',
    updated_at: convRow.updated_at ?? convRow.created_at ?? '',
  };

  const payload: GetConversationResponse = { conversation, messages };
  return NextResponse.json(payload);
}
