-- 20261019_ai_conversations_rls_align.sql
-- Aligns the investor RLS on terminal_ai_conversations with the deal statuses
-- the AI assistant is actually allowed to answer on, so a thread the user was
-- allowed to start is a thread they can still read afterwards.
--
-- THE MISMATCH
--   The chat workflow (6hz22YdBC500tHxg, node "Load Deal & Access") allows:
--     marketplace, investor_only, loi_signed, pending_final_loi,
--     psa_signed, published, assigned, closed
--   These policies allowed:
--     coming_soon, loi_signed, pending_final_loi, psa_signed,
--     published, assigned, closed
--
--   So marketplace and investor_only were chattable but the resulting thread
--   was invisible in the history list and could not be deleted, because the
--   workflow writes the conversation row with the service-role client (RLS
--   bypassed) while /api/ai/conversations reads it as the user (RLS enforced).
--   Measured on 2026-10-19: one investor held 145 conversations and could see
--   42. Across all users, 20 marketplace threads (2 users) were stranded.
--
--   coming_soon goes the other way: the policies allowed it, the workflow does
--   not. Zero conversations exist on coming_soon deals, so removing it strands
--   nothing.
--
-- WHAT THIS CHANGES
--   SELECT and INSERT move to the workflow's list: marketplace and
--   investor_only in, coming_soon out.
--
-- THE ONE DELIBERATE DEVIATION: DELETE
--   The DELETE policy loses its status condition entirely. Gating deletion on
--   the deal's status protects nothing (user_id = auth.uid() already limits a
--   caller to their own rows) and it manufactures undeletable garbage: 115
--   conversations across 5 users sit on cancelled deals today, and cancelled is
--   excluded from the assistant by design. Keeping the status gate on DELETE
--   would leave those 115 rows invisible AND permanently undeletable, with no
--   way for a user to clean up their own data. A user may always delete their
--   own conversation, whatever became of the deal afterwards.
--
--   Note this does NOT make cancelled threads readable. Per the access decision
--   of 2026-10-19 cancelled stays out of SELECT, so those 115 threads remain
--   hidden; they simply become removable. If you would rather users could still
--   read history on a deal that was later cancelled, add 'cancelled' to the
--   SELECT list only and say so, and it is a one-line change.
--
-- NOT CHANGED
--   ai_conversations_owner_employee_all (owner/employee keep full access).
--   investor_only is allowed here by status alone, with no group-membership
--   check. That is intentional: membership is enforced by the workflow when the
--   message is SENT, and these policies additionally require
--   user_id = auth.uid(), so a caller only ever reaches their own threads.
--   Re-checking membership on read would make a user's own history disappear
--   whenever a group assignment changed.
--
-- Depends on: 20260507_ai_assistant_rls.sql, 20260520_ai_conversation_drop_status.sql,
--             20261015_deal_status_pending_final_loi_psa_signed.sql
--
-- ROLLBACK:
--   begin;
--   drop policy if exists "ai_conversations_investor_own"    on public.terminal_ai_conversations;
--   drop policy if exists "ai_conversations_investor_insert" on public.terminal_ai_conversations;
--   drop policy if exists "ai_conversations_investor_delete" on public.terminal_ai_conversations;
--   create policy "ai_conversations_investor_own" on public.terminal_ai_conversations
--     for select using (terminal_user_role() = 'investor' and user_id = auth.uid()
--       and deal_id in (select id from public.terminal_deals where status in
--         ('coming_soon','loi_signed','pending_final_loi','psa_signed','published','assigned','closed')));
--   create policy "ai_conversations_investor_insert" on public.terminal_ai_conversations
--     for insert with check (terminal_user_role() = 'investor' and user_id = auth.uid()
--       and deal_id in (select id from public.terminal_deals where status in
--         ('coming_soon','loi_signed','pending_final_loi','psa_signed','published','assigned','closed')));
--   create policy "ai_conversations_investor_delete" on public.terminal_ai_conversations
--     for delete using (terminal_user_role() = 'investor' and user_id = auth.uid()
--       and deal_id in (select id from public.terminal_deals where status in
--         ('coming_soon','loi_signed','pending_final_loi','psa_signed','published','assigned','closed')));
--   commit;

BEGIN;

-- ── SELECT: read your own threads on any status the assistant answers on ───
DROP POLICY IF EXISTS "ai_conversations_investor_own" ON public.terminal_ai_conversations;
CREATE POLICY "ai_conversations_investor_own" ON public.terminal_ai_conversations
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND user_id = auth.uid()
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'marketplace', 'investor_only', 'loi_signed', 'pending_final_loi',
        'psa_signed', 'published', 'assigned', 'closed'
      )
    )
  );

-- ── INSERT: same list. (The workflow creates rows as service role, so this
--    path is mostly unused today; kept in step so it cannot drift.) ──────────
DROP POLICY IF EXISTS "ai_conversations_investor_insert" ON public.terminal_ai_conversations;
CREATE POLICY "ai_conversations_investor_insert" ON public.terminal_ai_conversations
  FOR INSERT WITH CHECK (
    terminal_user_role() = 'investor'
    AND user_id = auth.uid()
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'marketplace', 'investor_only', 'loi_signed', 'pending_final_loi',
        'psa_signed', 'published', 'assigned', 'closed'
      )
    )
  );

-- ── DELETE: no status condition. See "THE ONE DELIBERATE DEVIATION" above. ──
DROP POLICY IF EXISTS "ai_conversations_investor_delete" ON public.terminal_ai_conversations;
CREATE POLICY "ai_conversations_investor_delete" ON public.terminal_ai_conversations
  FOR DELETE USING (
    terminal_user_role() = 'investor'
    AND user_id = auth.uid()
  );

-- ── Verify inside the transaction ──────────────────────────────────────────
-- Any RAISE EXCEPTION aborts and leaves the old policies in place. Step 3 is
-- best-effort because not every admin connection may SET ROLE (the Supabase
-- MCP connection gets 42501), and a guard that cannot run must not block a
-- good migration.
DO $verify$
DECLARE
  v_sel    text;
  v_del    text;
  v_user   uuid;
  v_before bigint;
  v_after  bigint;
  v_actual bigint;
BEGIN
  -- 1. Shape: SELECT gained marketplace, lost coming_soon; DELETE has no status gate.
  SELECT pg_get_expr(polqual, polrelid) INTO v_sel FROM pg_policy
   WHERE polrelid='public.terminal_ai_conversations'::regclass
     AND polname='ai_conversations_investor_own';
  SELECT pg_get_expr(polqual, polrelid) INTO v_del FROM pg_policy
   WHERE polrelid='public.terminal_ai_conversations'::regclass
     AND polname='ai_conversations_investor_delete';

  IF v_sel IS NULL OR v_del IS NULL THEN
    RAISE EXCEPTION 'Expected policies were not created (select=%, delete=%).', v_sel IS NOT NULL, v_del IS NOT NULL;
  END IF;
  IF position('marketplace' IN v_sel) = 0 THEN
    RAISE EXCEPTION 'SELECT policy does not allow marketplace: %', v_sel;
  END IF;
  IF position('investor_only' IN v_sel) = 0 THEN
    RAISE EXCEPTION 'SELECT policy does not allow investor_only: %', v_sel;
  END IF;
  IF position('coming_soon' IN v_sel) > 0 THEN
    RAISE EXCEPTION 'SELECT policy still allows coming_soon: %', v_sel;
  END IF;
  IF position('terminal_deals' IN v_del) > 0 THEN
    RAISE EXCEPTION 'DELETE policy still gates on deal status: %', v_del;
  END IF;
  IF position('auth.uid()' IN v_del) = 0 THEN
    RAISE EXCEPTION 'DELETE policy lost its ownership check: %', v_del;
  END IF;

  -- 2. Arithmetic: somebody must actually gain visibility, or this was a no-op.
  SELECT count(*) INTO v_before FROM public.terminal_ai_conversations c
    JOIN public.terminal_deals d ON d.id=c.deal_id
   WHERE d.status IN ('coming_soon','loi_signed','pending_final_loi','psa_signed','published','assigned','closed');
  SELECT count(*) INTO v_after FROM public.terminal_ai_conversations c
    JOIN public.terminal_deals d ON d.id=c.deal_id
   WHERE d.status IN ('marketplace','investor_only','loi_signed','pending_final_loi','psa_signed','published','assigned','closed');

  IF v_after < v_before THEN
    RAISE EXCEPTION 'Alignment would REDUCE readable threads (% -> %). Check for stranded coming_soon rows.', v_before, v_after;
  END IF;
  RAISE NOTICE 'Readable investor threads: % -> % (+%).', v_before, v_after, v_after - v_before;

  -- 3. Best effort: read as a real investor and confirm the gain is live.
  SELECT c.user_id INTO v_user
  FROM public.terminal_ai_conversations c
  JOIN public.terminal_deals d ON d.id = c.deal_id
  JOIN public.terminal_users u ON u.id = c.user_id
  WHERE u.role = 'investor' AND d.status = 'marketplace'
  GROUP BY c.user_id ORDER BY count(*) DESC LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE 'No investor with marketplace threads; shape and arithmetic verified only.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_after FROM public.terminal_ai_conversations c
    JOIN public.terminal_deals d ON d.id=c.deal_id
   WHERE c.user_id = v_user
     AND d.status IN ('marketplace','investor_only','loi_signed','pending_final_loi','psa_signed','published','assigned','closed');

  BEGIN
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_actual FROM public.terminal_ai_conversations;
    RESET ROLE;

    IF v_actual <> v_after THEN
      RAISE EXCEPTION 'RLS wrong: investor % sees % threads, expected %.', v_user, v_actual, v_after;
    END IF;
    RAISE NOTICE 'Verified live: investor % now sees % threads.', v_user, v_actual;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RAISE NOTICE 'SET ROLE not permitted here, impersonation skipped. Shape and arithmetic verified; investor % should see % threads.',
        v_user, v_after;
  END;
END
$verify$;

COMMIT;
