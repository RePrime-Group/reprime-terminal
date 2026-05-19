import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Conversation, GetConversationResponse, Message } from '@/lib/ai/types';
import { isAssistantEnabled, jsonError, serviceDisabled } from '../../_runtime';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  extractCitationsFromText,
  rewriteMaxIterations,
  stripCitationMarkers,
} from '@/lib/ai/messageRewrite';

export const maxDuration = 10;

type N8nChatHistoryRow = {
  id: number;
  message: unknown;
};

type N8nChatMessage = {
  type?: string;
  content?: unknown;
};

function parseStoredMessage(raw: unknown): N8nChatMessage {
  if (raw && typeof raw === 'object') return raw as N8nChatMessage;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as N8nChatMessage;
    } catch {
      // fall through
    }
  }
  return {};
}

function roleFromType(type: string | undefined): Message['role'] {
  return type === 'human' ? 'user' : 'assistant';
}

function contentFromMessage(msg: N8nChatMessage): string {
  const c = msg.content;
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object' && 'text' in c && typeof (c as { text: unknown }).text === 'string') {
    return (c as { text: string }).text;
  }
  return '';
}

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

  // n8n_chat_histories is written by the Chat Memory node in workflow
  // 6hz22YdBC500tHxg using the LangChain Postgres adapter. session_id is the
  // conversation_id we pass in. Schema: id (int), session_id (text), message (jsonb).
  // n8n owns this table; we only read.
  const admin = createAdminClient();
  const { data: histRows, error: histErr } = await admin
    .from('n8n_chat_histories')
    .select('id, message')
    .eq('session_id', id)
    .order('id', { ascending: true });

  if (histErr) return jsonError('internal', histErr.message, 500);

  const fallbackTs = convRow.created_at ?? convRow.updated_at ?? new Date().toISOString();

  const messages: Message[] = await Promise.all(
    ((histRows ?? []) as N8nChatHistoryRow[]).map(async (row) => {
      const msg = parseStoredMessage(row.message);
      const role = roleFromType(msg.type);
      const rawContent = contentFromMessage(msg);
      const rewritten = rewriteMaxIterations(rawContent);
      const citations = await extractCitationsFromText(rewritten, convRow.deal_id, admin);
      const content = citations.length > 0 ? stripCitationMarkers(rewritten) : rewritten;
      return {
        id: String(row.id),
        role,
        content,
        citations,
        created_at: fallbackTs,
      } satisfies Message;
    }),
  );

  const conversation: Conversation = {
    id: convRow.id,
    deal_id: convRow.deal_id,
    title: convRow.title ?? '',
    updated_at: convRow.updated_at ?? convRow.created_at ?? '',
  };

  const payload: GetConversationResponse = { conversation, messages };
  return NextResponse.json(payload);
}
