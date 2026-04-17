import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * Per-request cached wrappers around auth.getUser() and the terminal_users row.
 *
 * Layouts and pages in the same request (e.g. /portal layout + /portal/portfolio page)
 * each used to trigger their own Supabase round-trips. React's cache() dedupes them to
 * a single call per render pass. Cache is per-request, so different users never share
 * state.
 */

export const getCurrentAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/**
 * Single "everything we ever need from terminal_users on the server" fetch.
 * Add columns here rather than creating parallel fetchers for subsets.
 */
export const getCurrentProfile = cache(async () => {
  const user = await getCurrentAuthUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('terminal_users')
    .select('id, role, full_name, email, phone, company_name, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();
  return data;
});
