-- 20261019_terminal_security_lockdown_phase1.sql
-- Closes the RePrime Terminal findings from the 2026-10-16 security review that
-- need NO application code change: F61, F62, F63, F64a, F66, F67, F69, F70.
--
-- F64b (invite expiry), F65 (data-room storage scoping) and F68 (KYC self-
-- approval) are deliberately NOT in this file -- each needs a code change first
-- or a design decision. See "DELIBERATELY NOT HERE" at the bottom.
--
-- WHY THIS IS SAFE TO APPLY AS-IS
--   Every call path for the objects touched below was traced before writing:
--     search_doc_chunks        -> only src/lib/ai/rag/hybrid-search.ts, via
--                                 admin.rpc() (service role), plus n8n (service role).
--     replace_doc_chunks       -> no application call sites at all; n8n only.
--     terminal_ai_usage_increment -> no application call sites; n8n only.
--     terminal_users           -> only written by /api/auth/create-profile, which
--                                 uses the service-role client and bypasses RLS.
--     terminal_invite_tokens   -> /api/invite/validate uses the service-role
--                                 client; the admin UI delete is covered by the
--                                 existing "Owners can manage invites" policy.
--     terminal_activity_log    -> the browser only ever inserts the 10 investor
--                                 actions; the 4 admin actions are written by
--                                 admin/server paths holding an owner session.
--     terminal_settings        -> every reader is an authenticated session or a
--                                 service-role client. The public deal page
--                                 (app/[locale]/deal/[id]) never reads settings.
--     terminal-deal-photos     -> every reader uses getPublicUrl(), which is a
--                                 pure string builder served by the public-bucket
--                                 path and does not consult storage RLS. There is
--                                 no .list() or .download() on that bucket.
--
-- ROLLBACK: see the inline note under each section.

BEGIN;

-- == F61 / F62: chunk functions were callable by anon =======================
-- Both are SECURITY DEFINER (so they bypass RLS) and neither checks the caller:
-- p_deal_id is just a parameter. search_doc_chunks therefore returned the text
-- of any deal's due-diligence chunks to anyone holding the publishable key, and
-- replace_doc_chunks let the same caller delete a document's chunks and insert
-- their own -- which is what the assistant then cites.
--
-- ROLLBACK: grant execute on <function> to anon, authenticated;
REVOKE EXECUTE ON FUNCTION
  public.search_doc_chunks(vector, uuid, text, integer, uuid, double precision)
  FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION
  public.replace_doc_chunks(uuid, uuid, jsonb)
  FROM anon, authenticated, PUBLIC;

-- == F67: AI usage counters could be inflated by anyone =====================
-- Also SECURITY DEFINER, and it was the one function here that still carried the
-- default EXECUTE-to-PUBLIC grant. It had no fixed search_path either.
--
-- ROLLBACK: grant execute on the function to anon, authenticated;
REVOKE EXECUTE ON FUNCTION
  public.terminal_ai_usage_increment(uuid, bigint, bigint, text, uuid)
  FROM anon, authenticated, PUBLIC;

ALTER FUNCTION public.terminal_ai_usage_increment(uuid, bigint, bigint, text, uuid)
  SET search_path = public;

-- terminal_user_role() is the helper every owner/employee policy in this schema
-- is keyed on, including the guard added below, so it is pinned here too. Its
-- body already schema-qualifies auth.uid(), so this is behaviour-neutral.
ALTER FUNCTION public.terminal_user_role() SET search_path = public;

-- == F63: any signed-in user could make themselves owner ====================
-- Two separate holes fed this.
--
-- (a) "Authenticated users can insert own row" had WITH CHECK (id = auth.uid())
--     and no constraint on role, so a fresh sign-up could insert themselves as
--     owner. Nothing in the app relies on it: create-profile uses the service
--     role and bypasses RLS, and there is no other insert into this table.
--
-- (b) "Users can update own row" has USING (id = auth.uid()) and NO WITH CHECK.
--     Postgres reuses the USING expression as the check in that case, so the
--     policy constrains WHICH row you may update but not WHAT you may set --
--     role, access_tier and permissions included. The policy is left in place
--     (it is the legitimate "edit my own profile" grant) and a BEFORE UPDATE
--     trigger now guards the privileged columns instead, so the fix holds even
--     if the policy is rewritten later.
--
-- ROLLBACK: drop trigger terminal_users_guard_privileged on public.terminal_users;
--           and recreate the insert policy with WITH CHECK (id = auth.uid()).
DROP POLICY IF EXISTS "Authenticated users can insert own row" ON public.terminal_users;

CREATE OR REPLACE FUNCTION public.terminal_users_guard_privileged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $guard$
BEGIN
  -- is_active and team_invite_limit are NOT named in the review's F63, but they
  -- are privileged by the same reading: a deactivated user could switch
  -- themselves back on, and an investor could lift their own team-invite quota.
  -- Drop those two lines if you want this to match the report exactly.
  IF new.role               IS DISTINCT FROM old.role
  OR new.access_tier        IS DISTINCT FROM old.access_tier
  OR new.permissions        IS DISTINCT FROM old.permissions
  OR new.parent_investor_id IS DISTINCT FROM old.parent_investor_id
  OR new.is_active          IS DISTINCT FROM old.is_active
  OR new.team_invite_limit  IS DISTINCT FROM old.team_invite_limit
  THEN
    -- No JWT: service-role / server-side callers (create-profile, n8n, admin
    -- scripts). These are already trusted and bypass RLS anyway.
    IF auth.uid() IS NULL THEN
      RETURN new;
    END IF;

    -- Owners legitimately re-role other users from the admin UI.
    IF public.terminal_user_role() = 'owner' THEN
      RETURN new;
    END IF;

    RAISE EXCEPTION
      'terminal_users: privileged fields cannot be changed by this user'
      USING ERRCODE = '42501';
  END IF;

  RETURN new;
END;
$guard$;

DROP TRIGGER IF EXISTS terminal_users_guard_privileged ON public.terminal_users;
CREATE TRIGGER terminal_users_guard_privileged
  BEFORE UPDATE ON public.terminal_users
  FOR EACH ROW EXECUTE FUNCTION public.terminal_users_guard_privileged();

-- == F64a: every invite token was readable by anyone ========================
-- "Public can validate token" was SELECT USING (true), and anon holds a SELECT
-- grant on this table, so it was live rather than dead policy: all 112 tokens
-- and their email addresses were readable straight off PostgREST. The token is a
-- bearer secret, so this alone defeats the invite system.
--
-- Nothing legitimate needs it: /api/invite/validate reads the token with the
-- service-role client, and the admin UI's read/delete is covered by the existing
-- "Owners can manage invites" policy.
--
-- NOTE: this does NOT fix the second half of F64 -- /api/auth/create-profile
-- still never checks expires_at. That is a code change; see the bottom of this file.
--
-- ROLLBACK: create policy "Public can validate token" on
--           public.terminal_invite_tokens for select using (true);
DROP POLICY IF EXISTS "Public can validate token" ON public.terminal_invite_tokens;

-- == F69: investors could post fake "deal published" activity ===============
-- The insert policy only checked user_id = auth.uid(), nothing about action,
-- while the investor read policy surfaces exactly these four admin actions to
-- every investor. So any investor could fabricate deal activity in everyone's
-- feed. The four names are kept in step with "Investors can view admin activity".
--
-- ROLLBACK: recreate the policy with WITH CHECK (user_id = auth.uid()).
DROP POLICY IF EXISTS "Users can insert own activity" ON public.terminal_activity_log;
CREATE POLICY "Users can insert own activity" ON public.terminal_activity_log
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
      OR action <> ALL (ARRAY[
        'deal_created'::text,
        'deal_published'::text,
        'deal_updated'::text,
        'deal_document_uploaded'::text
      ])
    )
  );

-- == F70: business settings were readable by anon ===========================
-- The existing carve-out for activity_webhook_% keys is preserved exactly; this
-- only adds the requirement that the caller be signed in at all.
--
-- ROLLBACK: recreate without the auth.uid() IS NOT NULL conjunct.
DROP POLICY IF EXISTS "Everyone can read settings" ON public.terminal_settings;
CREATE POLICY "Everyone can read settings" ON public.terminal_settings
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (key NOT LIKE 'activity_webhook_%' OR terminal_user_role() = 'owner')
  );

-- == F66: anon could enumerate the deal-photos bucket =======================
-- The bucket stays public, so getPublicUrl() keeps working for the marketplace
-- and the public deal pages -- those are served by the public-object path and do
-- not consult this policy. What this removes is anon's ability to LIST the
-- bucket, which was enumerating every deal id.
--
-- ROLLBACK: recreate with USING (bucket_id = 'terminal-deal-photos').
DROP POLICY IF EXISTS "Public can view deal photos" ON storage.objects;
CREATE POLICY "Authenticated can view deal photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'terminal-deal-photos'
    AND auth.role() = 'authenticated'
  );

-- == Verify inside the transaction ==========================================
DO $verify$
DECLARE
  v_fn   oid;
  v_txt  text;
  v_n    int;
BEGIN
  -- 1. The three functions must no longer be callable by anon or authenticated.
  --    Guarded on count as well, so a renamed function cannot make this pass
  --    vacuously by matching nothing.
  SELECT count(*) INTO v_n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('search_doc_chunks','replace_doc_chunks','terminal_ai_usage_increment');
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'Expected 3 target functions, found %. Check the names before trusting this migration.', v_n;
  END IF;

  FOR v_fn IN
    SELECT p.oid
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('search_doc_chunks','replace_doc_chunks','terminal_ai_usage_increment')
  LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can still execute: %', v_fn::regprocedure::text;
    END IF;
    IF has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated can still execute: %', v_fn::regprocedure::text;
    END IF;
  END LOOP;

  -- 2. service_role must KEEP execute, or ingestion and retrieval both break.
  IF NOT has_function_privilege('service_role',
       'public.search_doc_chunks(vector, uuid, text, integer, uuid, double precision)'::regprocedure,
       'EXECUTE')
  THEN
    RAISE EXCEPTION 'service_role lost EXECUTE on search_doc_chunks; n8n retrieval would break.';
  END IF;
  IF NOT has_function_privilege('service_role',
       'public.replace_doc_chunks(uuid, uuid, jsonb)'::regprocedure, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'service_role lost EXECUTE on replace_doc_chunks; n8n ingestion would break.';
  END IF;

  -- 3. F63: insert policy gone, guard trigger present and enabled.
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='terminal_users'
               AND policyname='Authenticated users can insert own row') THEN
    RAISE EXCEPTION 'The self-insert policy on terminal_users is still present.';
  END IF;

  SELECT count(*) INTO v_n FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname='terminal_users'
     AND t.tgname='terminal_users_guard_privileged'
     AND t.tgenabled <> 'D';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'The terminal_users privilege guard trigger is missing or disabled.';
  END IF;

  -- 4. F64a: the public invite policy must be gone, the owner policy must remain.
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname='public' AND tablename='terminal_invite_tokens'
               AND policyname='Public can validate token') THEN
    RAISE EXCEPTION 'The public invite-token policy is still present.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='terminal_invite_tokens'
                   AND policyname='Owners can manage invites') THEN
    RAISE EXCEPTION 'The owner invite policy went missing; the admin UI would break.';
  END IF;

  -- 5. F69: the four admin action names must appear in the new check.
  SELECT with_check INTO v_txt FROM pg_policies
   WHERE schemaname='public' AND tablename='terminal_activity_log'
     AND policyname='Users can insert own activity';
  IF v_txt IS NULL OR position('deal_published' IN v_txt) = 0 THEN
    RAISE EXCEPTION 'The activity insert policy is not guarding admin action names.';
  END IF;

  -- 6. F70: settings must now require a session, and keep the webhook carve-out.
  SELECT qual INTO v_txt FROM pg_policies
   WHERE schemaname='public' AND tablename='terminal_settings'
     AND policyname='Everyone can read settings';
  IF v_txt IS NULL OR position('auth.uid()' IN v_txt) = 0 THEN
    RAISE EXCEPTION 'The settings read policy does not require a session.';
  END IF;
  IF position('activity_webhook' IN v_txt) = 0 THEN
    RAISE EXCEPTION 'The settings read policy lost the webhook carve-out.';
  END IF;

  -- 7. F66: no remaining storage policy may expose deal photos without a session.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='storage' AND tablename='objects' AND cmd='SELECT'
       AND qual LIKE '%terminal-deal-photos%'
       AND qual NOT LIKE '%authenticated%'
  ) THEN
    RAISE EXCEPTION 'A session-less SELECT policy on terminal-deal-photos still exists.';
  END IF;

  RAISE NOTICE 'Phase 1 lockdown verified: F61, F62, F63, F64a, F66, F67, F69, F70.';
END
$verify$;

COMMIT;

-- == DELIBERATELY NOT HERE ==================================================
-- F64b  /api/auth/create-profile selects email, role, accepted_at,
--       parent_investor_id, permissions, access_tier -- but never expires_at, so
--       expiry is enforced only on the UI path (/api/invite/validate). 40 invites
--       are unaccepted and ALL 40 are already expired, oldest 2026-03-25, and all
--       40 stay redeemable until that route checks expiry. Code change first.
--
-- F65   storage.objects for terminal-dd-documents gates on
--       auth.role() = 'authenticated' and nothing else, for SELECT, INSERT,
--       UPDATE and DELETE -- so any signed-in user can read, overwrite or delete
--       all 3,311 data-room files. Scoping the read to visible document rows has
--       to match what CitationDrawer.tsx and DealDetailClient.tsx mint signed
--       URLs for, or the drawer and the data room break. Needs the visibility
--       model pinned down first.
--
-- F68   /api/onboarding/kyc computes the accreditation decision server-side but
--       writes approved with the USER'S OWN session (createClient from
--       @/lib/supabase/server), so it relies on kyc_update_own. Adding the guard
--       trigger before that route moves to the service-role client would break
--       onboarding. Code change FIRST, then the trigger.
