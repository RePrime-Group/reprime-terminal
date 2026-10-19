-- 20261019_terminal_security_lockdown_phase3_access_tier.sql
-- Makes the database enforce access_tier = 'marketplace_only'.
--
-- WHAT WAS WRONG
--   A marketplace_only investor is meant to see the marketplace and their
--   curated groups, nothing else (src/proxy.ts; SHOW_CURATED_TABS_FOR_
--   MARKETPLACE_ONLY in src/lib/constants.ts). But only the proxy enforced that,
--   and the proxy only guards PAGES -- its matcher skips /api entirely. Through
--   PostgREST or the API routes, a marketplace_only investor could read every
--   published / LOI / PSA / closed deal and everything hanging off it.
--
-- WHAT THIS DOES
--   1. Adds terminal_user_access_tier(), the tier counterpart of
--      terminal_user_role().
--   2. Adds the tier test to the two terminal_deals investor policies that grant
--      by deal stage. "Investors can view marketplace deals" and "member reads
--      curated deals" are deliberately left alone, so marketplace and curated
--      access are unchanged.
--   3. Backfills the 4 investors whose access_tier is NULL to 'investor'. The
--      app already treats NULL as full access (it only restricts an exact
--      'marketplace_only'), and create-profile now always sets a tier; this just
--      stops their access depending on that convention.
--
-- WHY ONLY TWO POLICIES
--   Every investor policy on the deal's child tables (documents, folders,
--   photos, chunks, tenant leases, capex, insights, tasks, task attachments,
--   addresses, AI conversations, activity) decides access with a plain
--   subquery on terminal_deals -- 22 policies, checked. Those subqueries run
--   under the caller's RLS, so hiding a deal in terminal_deals hides it in all of
--   them. Storage follows too, through the phase 2 rule on document rows.
--
-- PAIRED CHANGE OUTSIDE THIS FILE (already published 2026-10-19)
--   n8n chat workflow 6hz22YdBC500tHxg, node "Load Deal & Access": runs on the
--   service role, so it does not inherit RLS. Its status branch now carries the
--   same tier test, verified against both tiers before publishing.
--
-- WHO THIS AFFECTS TODAY
--   One marketplace_only investor, created 2026-04-23, last signed in
--   2026-04-28, in no groups. Nobody else's access changes.
--
-- ROLLBACK:
--   Recreate both policies without the terminal_user_access_tier() conjunct.
--   The function and the backfill are harmless to keep.

BEGIN;

CREATE OR REPLACE FUNCTION public.terminal_user_access_tier()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT access_tier FROM terminal_users WHERE id = auth.uid()
$fn$;

REVOKE EXECUTE ON FUNCTION public.terminal_user_access_tier() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.terminal_user_access_tier() TO authenticated;

-- Runs with no JWT, so the phase 1 privilege guard on terminal_users allows it.
UPDATE public.terminal_users
   SET access_tier = 'investor'
 WHERE role = 'investor' AND access_tier IS NULL;

DROP POLICY IF EXISTS "Investors can view visible deals" ON public.terminal_deals;
CREATE POLICY "Investors can view visible deals" ON public.terminal_deals
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND public.terminal_user_access_tier() IS DISTINCT FROM 'marketplace_only'
    AND status = ANY (ARRAY[
      'coming_soon'::text, 'loi_signed'::text, 'pending_final_loi'::text,
      'psa_signed'::text, 'published'::text, 'assigned'::text,
      'closed'::text, 'cancelled'::text
    ])
  );

DROP POLICY IF EXISTS "Investors can view published deals" ON public.terminal_deals;
CREATE POLICY "Investors can view published deals" ON public.terminal_deals
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND public.terminal_user_access_tier() IS DISTINCT FROM 'marketplace_only'
    AND status = ANY (ARRAY['published'::text, 'assigned'::text, 'closed'::text])
  );

-- == Verify inside the transaction ==========================================
DO $verify$
DECLARE
  v_n      int;
  v_mo     uuid;
  v_full   uuid;
  v_mkt    bigint;
  v_staged bigint;
BEGIN
  -- 1. Backfill complete.
  SELECT count(*) INTO v_n FROM public.terminal_users
   WHERE role = 'investor' AND access_tier IS NULL;
  IF v_n <> 0 THEN
    RAISE EXCEPTION '% investors still have no access tier.', v_n;
  END IF;

  -- 2. Both stage-based policies carry the tier test.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='terminal_deals'
     AND policyname IN ('Investors can view visible deals','Investors can view published deals')
     AND qual LIKE '%terminal_user_access_tier%';
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'Expected the tier test on 2 terminal_deals policies, found %.', v_n;
  END IF;

  -- 3. Marketplace and curated access were not touched.
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='terminal_deals'
               AND policyname IN ('Investors can view marketplace deals','member reads curated deals')
               AND qual LIKE '%access_tier%') THEN
    RAISE EXCEPTION 'Marketplace or curated deal access was changed; it must not be.';
  END IF;

  -- 4. Live, best effort: marketplace_only sees marketplace deals but no staged
  --    ones; a full-tier investor still sees staged deals.
  SELECT id INTO v_mo FROM public.terminal_users
   WHERE role='investor' AND access_tier='marketplace_only' LIMIT 1;
  SELECT id INTO v_full FROM public.terminal_users
   WHERE role='investor' AND access_tier='investor' LIMIT 1;

  BEGIN
    SET LOCAL ROLE authenticated;

    IF v_mo IS NOT NULL THEN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', v_mo, 'role', 'authenticated')::text, true);
      SELECT count(*) FILTER (WHERE status = 'marketplace'),
             count(*) FILTER (WHERE status <> 'marketplace')
        INTO v_mkt, v_staged
        FROM public.terminal_deals;
      IF v_staged > 0 THEN
        RAISE EXCEPTION 'marketplace_only investor still sees % non-marketplace deals.', v_staged;
      END IF;
      IF v_mkt = 0 THEN
        RAISE EXCEPTION 'marketplace_only investor lost the marketplace.';
      END IF;
      RAISE NOTICE 'marketplace_only investor: % marketplace deals, 0 others.', v_mkt;
    END IF;

    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_full, 'role', 'authenticated')::text, true);
    SELECT count(*) FILTER (WHERE status <> 'marketplace') INTO v_staged FROM public.terminal_deals;
    IF v_staged = 0 THEN
      RAISE EXCEPTION 'A full-tier investor lost every non-marketplace deal.';
    END IF;
    RAISE NOTICE 'full-tier investor still sees % non-marketplace deals.', v_staged;

    RESET ROLE;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RAISE NOTICE 'SET ROLE not permitted here; impersonation skipped.';
  END;
END
$verify$;

COMMIT;
