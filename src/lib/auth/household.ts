import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Returns the set of user ids that make up the investor "household" for the
 * given user — the parent investor plus any team-invited sub-users. Used for
 * household-level duplicate checks (e.g. one commitment per household per
 * deal) and for allowing any household member to act on commitments owned by
 * any other household member.
 *
 * A user with no parent_investor_id AND no sub-users is just themselves.
 */
export async function getHouseholdUserIds(userId: string): Promise<string[]> {
  const admin = createAdminClient();

  const { data: me } = await admin
    .from('terminal_users')
    .select('id, parent_investor_id')
    .eq('id', userId)
    .single();

  if (!me) return [userId];

  const rootId = me.parent_investor_id ?? me.id;

  const { data: subs } = await admin
    .from('terminal_users')
    .select('id')
    .eq('parent_investor_id', rootId);

  const ids = new Set<string>([rootId, ...(subs ?? []).map((s) => s.id)]);
  ids.add(userId);
  return [...ids];
}
