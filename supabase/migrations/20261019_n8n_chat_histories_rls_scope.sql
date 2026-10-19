-- 20261019_n8n_chat_histories_rls_scope.sql
-- Scopes read access to n8n_chat_histories, which currently exposes every
-- investor's AI assistant transcript to every other signed-in user.
--
-- THE PROBLEM
--   n8n_chat_histories holds the actual message turns of the deal assistant
--   (session_id = terminal_ai_conversations.id, message = the human/ai turn).
--   Its only RLS policy is:
--
--     "Enable read access for authenticated users"  SELECT  {authenticated}  USING (true)
--
--   USING (true) with no user scoping, so any signed-in investor running
--   supabase.from('n8n_chat_histories').select('*') from the browser reads all
--   1,084 rows: every other investor's questions and the assistant's answers,
--   including deal financials, rent rolls and document contents. The table is
--   created and owned by n8n, which is why it never got the scoping the
--   terminal_* tables have.
--
-- WHY NOTHING BREAKS (all three verified on 2026-10-19 before writing this)
--   1. The app does NOT read this table as the user. /api/ai/conversations/[id]
--      reads it with the service-role client, after doing its own ownership
--      check (convRow.user_id !== user.id -> 403). Service role bypasses RLS.
--   2. n8n's Chat Memory node writes over a direct Postgres connection as the
--      table owner, and relforcerowsecurity is FALSE, so the owner bypasses RLS.
--      Tightening a SELECT policy cannot affect those writes.
--   3. deleteConversation() in src/lib/ai/actions.ts purges history with the
--      service-role client. Also bypasses RLS.
--   In other words the permissive policy serves no caller in the application.
--   The only thing USING (true) enables is the direct client-side read above.
--
-- WHAT THIS CHANGES
--   Replaces that policy with one that lets a caller read only the turns of
--   conversations they own, and lets owner/employee read everything (mirroring
--   ai_conversations_owner_employee_all on terminal_ai_conversations).
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   No INSERT / UPDATE / DELETE policies are added. There are none today, and
--   with RLS enabled that already denies those operations to any role that does
--   not bypass RLS. Every legitimate writer (n8n as owner, the delete action as
--   service role) bypasses RLS, so adding write policies would only widen
--   access. Leave them absent.
--
-- NOTE ON THE JOIN
--   session_id is text and terminal_ai_conversations.id is uuid. The comparison
--   is done as c.id::text = h.session_id rather than h.session_id::uuid = c.id
--   on purpose: all 288 session_ids are valid uuids today, but this table is
--   owned by n8n and a future workflow writing a non-uuid session_id would make
--   the cast raise 22P02 inside a policy, which fails the query rather than
--   hiding a row. Comparing as text can never raise. terminal_ai_conversations
--   is small (288 rows) so the lost index lookup does not matter, and in
--   practice callers filter by a single session_id first.
--
-- ROLLBACK:
--   begin;
--   drop policy if exists "chat_histories_own_conversations_read" on public.n8n_chat_histories;
--   create policy "Enable read access for authenticated users"
--     on public.n8n_chat_histories for select to authenticated using (true);
--   commit;
--   (Only do this if something genuinely depended on the open read. Nothing in
--   the app does; see WHY NOTHING BREAKS above.)

BEGIN;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.n8n_chat_histories;

CREATE POLICY "chat_histories_own_conversations_read" ON public.n8n_chat_histories
  FOR SELECT TO authenticated
  USING (
    terminal_user_role() = ANY (ARRAY['owner', 'employee'])
    OR EXISTS (
      SELECT 1
      FROM public.terminal_ai_conversations c
      WHERE c.id::text = n8n_chat_histories.session_id
        AND c.user_id = auth.uid()
    )
  );

-- ── Verify, inside the transaction ─────────────────────────────────────────
-- Create the policy, then exercise it. Any RAISE EXCEPTION below aborts the
-- transaction, so the old policy survives and a broken one can never be left
-- live. Written in three steps because step 3 needs a privilege that not every
-- admin connection holds, and a guard that cannot run must not block the fix
-- (the Supabase MCP connection, for one, gets 42501 on SET ROLE authenticated).
DO $verify$
DECLARE
  v_user   uuid;
  v_expect bigint;
  v_actual bigint;
  v_total  bigint;
  v_def    text;
BEGIN
  -- 1. The policy exists and is not the unscoped one we just removed.
  SELECT pg_get_expr(pol.polqual, pol.polrelid) INTO v_def
  FROM pg_policy pol
  WHERE pol.polrelid = 'public.n8n_chat_histories'::regclass
    AND pol.polname  = 'chat_histories_own_conversations_read';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Policy chat_histories_own_conversations_read was not created.';
  END IF;
  IF v_def = 'true' THEN
    RAISE EXCEPTION 'Policy is unscoped (USING true), which is the bug this migration fixes.';
  END IF;
  IF position('terminal_ai_conversations' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Policy does not scope through terminal_ai_conversations: %', v_def;
  END IF;

  -- 2. The scope actually excludes rows for a real investor.
  SELECT c.user_id INTO v_user
  FROM public.terminal_ai_conversations c
  JOIN public.terminal_users u ON u.id = c.user_id
  WHERE u.role = 'investor'
  GROUP BY c.user_id
  ORDER BY count(*) DESC
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE 'No investor with conversations; policy shape verified, scope not exercised.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_total FROM public.n8n_chat_histories;
  SELECT count(*) INTO v_expect
  FROM public.n8n_chat_histories h
  WHERE EXISTS (
    SELECT 1 FROM public.terminal_ai_conversations c
    WHERE c.id::text = h.session_id AND c.user_id = v_user
  );

  IF v_total > 0 AND v_expect >= v_total THEN
    RAISE EXCEPTION
      'Scope would hide nothing: busiest investor % already accounts for all % rows.', v_user, v_total;
  END IF;

  -- 3. Best effort: become that investor and confirm the policy restricts for
  --    real. Skipped (not failed) when the applying role cannot SET ROLE.
  BEGIN
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_actual FROM public.n8n_chat_histories;
    RESET ROLE;

    IF v_actual <> v_expect THEN
      RAISE EXCEPTION 'RLS scope wrong: investor % sees % rows, expected % of %.',
        v_user, v_actual, v_expect, v_total;
    END IF;

    RAISE NOTICE 'Verified live: investor % now sees % of % rows (all % before).',
      v_user, v_actual, v_total, v_total;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RAISE NOTICE
        'Could not SET ROLE authenticated on this connection, so impersonation was skipped. Policy shape and scope verified: investor % would see % of % rows.',
        v_user, v_expect, v_total;
  END;
END
$verify$;

COMMIT;
