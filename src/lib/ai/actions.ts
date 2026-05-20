'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
