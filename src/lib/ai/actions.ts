'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AI_ASSISTANT_STATUSES } from '@/lib/constants';

export interface DealSearchResult {
  id: string;
  name: string;
}

/**
 * Search the deals the signed-in user may ask the assistant about.
 *
 * Runs on the server so the WHOLE set is searchable. The picker used to fetch
 * one page of deals and filter it in the browser, which meant a deal outside
 * that page produced "No deals found" rather than simply being further down
 * the list: indistinguishable, to the user, from the deal not existing.
 *
 * Rows are scoped by RLS to what this user may see; the status filter then
 * removes deals the chat workflow refuses, so the picker cannot offer
 * something that would come back 403 on the first message.
 */
export async function searchDeals(
  query: string,
  limit = 50,
): Promise<DealSearchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in required.');

  let q = supabase
    .from('terminal_deals')
    .select('id, name')
    .in('status', AI_ASSISTANT_STATUSES)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  const term = query.trim();
  if (term) {
    // Escape the LIKE metacharacters, so typing % or _ searches for that
    // literal character instead of silently matching everything.
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    q = q.ilike('name', `%${escaped}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as DealSearchResult[];
}

/**
 * Permanently delete a conversation and its messages.
 * The conversation row lives in terminal_ai_conversations (RLS-scoped to the
 * caller); the message rows live in the n8n-owned n8n_chat_histories table
 * keyed by session_id = conversation id, purged with the service-role client.
 */
export async function deleteConversation(id: string): Promise<{ ok: true }> {
  if (!id) throw new Error('Conversation id is required.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in required.');

  // RLS enforces ownership; scope to the user explicitly as a second guard.
  const { error } = await supabase
    .from('terminal_ai_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw new Error(error.message);

  // Purge the conversation's message history (n8n-owned table, service-role).
  const admin = createAdminClient();
  await admin.from('n8n_chat_histories').delete().eq('session_id', id);

  return { ok: true };
}
