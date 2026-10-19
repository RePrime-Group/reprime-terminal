-- 20261019_ai_conversations_allow_cancelled.sql
-- Lets investors read (and start) assistant threads on cancelled deals.
--
-- WHY
--   The access list agreed earlier on 2026-10-19 excluded 'cancelled' from the
--   assistant. Checking the data afterwards showed that was not a dormant
--   case: 115 threads sit on cancelled deals, and two investors were using
--   them as recently as 5 and 6 days ago, 9 threads between them in the last
--   30 days. Every one of those conversations happened AFTER the deal was
--   cancelled, repeatedly and across four different deals, so this is
--   deliberate research on dead deals (a cancelled deal is still a comp, and
--   the dataroom is still the record of why it fell through) rather than
--   history being stranded by a status change underneath the user.
--
--   Excluding 'cancelled' would have taken a weekly workflow away from two
--   active investors and hidden 18 threads they had already built. Decision
--   (Ali, 2026-10-19): allow cancelled deals to be chatted and read.
--
-- WHAT THIS CHANGES
--   Adds 'cancelled' to the SELECT and INSERT policies on
--   terminal_ai_conversations, so the 115 existing threads become readable
--   again and new ones can be created.
--
--   DELETE is untouched: 20261019_ai_conversations_rls_align.sql already
--   removed its status condition entirely, so deletion never depended on it.
--
-- PAIRED CHANGES OUTSIDE THIS FILE (both required, or the result is uneven)
--   1. n8n chat workflow 6hz22YdBC500tHxg, node "Load Deal & Access": add
--      'cancelled' to the status allowlist, otherwise the request is still
--      refused with a 403 before it reaches the agent.
--   2. AI_ASSISTANT_STATUSES in src/lib/constants.ts: add 'cancelled', so the
--      deal page offers the assistant and the picker lists those deals.
--
-- KNOWN GAP, NOT FIXED HERE
--   Cancelled deals are excluded from the ingestion backfill, so their
--   documents are not indexed and Search_Deal_Documents returns nothing for
--   them. The assistant can still answer from the deal row and the rent roll.
--   Closing that means adding 'cancelled' to "Select Pending Docs" in
--   Po35WsflKy9wGR4g, which was deliberately left alone.
--
-- Depends on: 20261019_ai_conversations_rls_align.sql
--
-- ROLLBACK:
--   Re-run 20261019_ai_conversations_rls_align.sql, which recreates both
--   policies without 'cancelled'.

BEGIN;

DROP POLICY IF EXISTS "ai_conversations_investor_own" ON public.terminal_ai_conversations;
CREATE POLICY "ai_conversations_investor_own" ON public.terminal_ai_conversations
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND user_id = auth.uid()
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'marketplace', 'investor_only', 'loi_signed', 'pending_final_loi',
        'psa_signed', 'published', 'assigned', 'closed', 'cancelled'
      )
    )
  );

DROP POLICY IF EXISTS "ai_conversations_investor_insert" ON public.terminal_ai_conversations;
CREATE POLICY "ai_conversations_investor_insert" ON public.terminal_ai_conversations
  FOR INSERT WITH CHECK (
    terminal_user_role() = 'investor'
    AND user_id = auth.uid()
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'marketplace', 'investor_only', 'loi_signed', 'pending_final_loi',
        'psa_signed', 'published', 'assigned', 'closed', 'cancelled'
      )
    )
  );

-- ── Verify inside the transaction ──────────────────────────────────────────
-- Step 3 is best effort: not every admin connection may SET ROLE (the Supabase
-- MCP connection gets 42501), and a guard that cannot run must not block the
-- migration.
DO $verify$
DECLARE
  v_sel    text;
  v_ins    text;
  v_user   uuid;
  v_before bigint;
  v_after  bigint;
  v_actual bigint;
BEGIN
  -- 1. Shape.
  SELECT pg_get_expr(polqual, polrelid) INTO v_sel FROM pg_policy
   WHERE polrelid='public.terminal_ai_conversations'::regclass
     AND polname='ai_conversations_investor_own';
  SELECT pg_get_expr(polwithcheck, polrelid) INTO v_ins FROM pg_policy
   WHERE polrelid='public.terminal_ai_conversations'::regclass
     AND polname='ai_conversations_investor_insert';

  IF v_sel IS NULL OR v_ins IS NULL THEN
    RAISE EXCEPTION 'Expected policies were not created.';
  END IF;
  IF position('cancelled' IN v_sel) = 0 THEN
    RAISE EXCEPTION 'SELECT policy does not allow cancelled: %', v_sel;
  END IF;
  IF position('cancelled' IN v_ins) = 0 THEN
    RAISE EXCEPTION 'INSERT policy does not allow cancelled: %', v_ins;
  END IF;
  IF position('auth.uid()' IN v_sel) = 0 THEN
    RAISE EXCEPTION 'SELECT policy lost its ownership check: %', v_sel;
  END IF;

  -- 2. Somebody must actually gain threads, or this was a no-op.
  SELECT count(*) INTO v_before FROM public.terminal_ai_conversations c
    JOIN public.terminal_deals d ON d.id=c.deal_id
   WHERE d.status IN ('marketplace','investor_only','loi_signed','pending_final_loi',
                      'psa_signed','published','assigned','closed');
  SELECT count(*) INTO v_after FROM public.terminal_ai_conversations c
    JOIN public.terminal_deals d ON d.id=c.deal_id
   WHERE d.status IN ('marketplace','investor_only','loi_signed','pending_final_loi',
                      'psa_signed','published','assigned','closed','cancelled');

  IF v_after <= v_before THEN
    RAISE EXCEPTION 'No cancelled threads became readable (% -> %); expected an increase.',
      v_before, v_after;
  END IF;
  RAISE NOTICE 'Readable investor threads: % -> % (+% on cancelled deals).',
    v_before, v_after, v_after - v_before;

  -- 3. Best effort: read as an investor who actually holds cancelled threads.
  SELECT c.user_id INTO v_user
  FROM public.terminal_ai_conversations c
  JOIN public.terminal_deals d ON d.id = c.deal_id
  JOIN public.terminal_users u ON u.id = c.user_id
  WHERE u.role = 'investor' AND d.status = 'cancelled'
  GROUP BY c.user_id ORDER BY max(c.created_at) DESC LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE 'No investor holds cancelled threads; shape and arithmetic verified only.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_after FROM public.terminal_ai_conversations c
    JOIN public.terminal_deals d ON d.id=c.deal_id
   WHERE c.user_id = v_user
     AND d.status IN ('marketplace','investor_only','loi_signed','pending_final_loi',
                      'psa_signed','published','assigned','closed','cancelled');

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
      RAISE NOTICE 'SET ROLE not permitted here, impersonation skipped. Investor % should see % threads.',
        v_user, v_after;
  END;
END
$verify$;

COMMIT;
