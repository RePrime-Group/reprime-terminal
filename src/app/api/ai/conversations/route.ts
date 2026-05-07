import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Conversation, ListConversationsResponse } from '@/lib/ai/types';
import { isAssistantEnabled, jsonError, serviceDisabled } from '../_runtime';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  if (!isAssistantEnabled()) return serviceDisabled();

  const dealId = request.nextUrl.searchParams.get('deal_id');
  if (!dealId) return jsonError('bad_request', 'deal_id is required.', 400);

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

  const { data, error } = await supabase
    .from('terminal_ai_conversations')
    .select('id, deal_id, title, updated_at, created_at')
    .eq('deal_id', dealId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) return jsonError('internal', error.message, 500);

  const conversations: Conversation[] = (data ?? []).map((row) => ({
    id: row.id,
    deal_id: row.deal_id,
    title: row.title ?? '',
    updated_at: row.updated_at ?? row.created_at ?? '',
  }));

  const payload: ListConversationsResponse = { conversations };
  return NextResponse.json(payload);
}
