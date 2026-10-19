-- 20261019_terminal_security_lockdown_phase1b.sql
-- Closes the "anyone can sign up and reach it" gap left after phase 1.
--
-- WHY THIS EXISTS
--   Sign-up has to stay open on Terminal so invites work. After phase 1 the
--   public schema is fine: every policy keys on terminal_user_role() or on
--   user_id = auth.uid(), both of which fail closed for an account with no
--   terminal_users row. Storage did not get that treatment. All 16 policies on
--   the four Terminal buckets gated on auth.role() = 'authenticated' and
--   nothing else, so anyone who signed up -- no invite, no profile, no deal --
--   could read, overwrite and DELETE all 3,311 data-room files.
--
--   This replaces "is signed in" with one of two tests:
--     member : public.terminal_user_role() IS NOT NULL   (was actually invited)
--     staff  : public.terminal_user_role() IN ('owner','employee')
--   terminal_user_role() is SECURITY DEFINER, returns NULL for an account with
--   no terminal_users row, and authenticated already holds EXECUTE on it.
--
-- THIS IS AN INTERIM FIX FOR F65, NOT THE WHOLE THING
--   It removes the self-signup path, which is the part that is reachable from
--   the open internet today. It does NOT yet scope an investor's reads to the
--   documents of deals they can actually see -- one invited investor can still
--   read another deal's files. That needs the per-deal visibility model pinned
--   down against what CitationDrawer.tsx and DealDetailClient.tsx mint signed
--   URLs for, and is deliberately left for the full F65 pass.
--
-- WHY THE WRITE LOCKDOWN IS SAFE
--   Traced before writing -- there is no investor-side write anywhere:
--     - No .upload() or .remove() exists in src/components/portal or
--       src/app/[locale]/(portal). Not one.
--     - uploadFileToFolder / bulkZipUpload / downloadAndUploadPhotos take a
--       client as a parameter; every caller is under (admin)/admin/.
--     - dataroom/actions.ts uses createAdminClient() (service role, bypasses RLS).
--     - ai-classify, extract-zip and extract-from-docs upload on a user session
--       but ALREADY reject anyone who is not owner/employee in app code, so the
--       policy just moves that check where it cannot be bypassed.
--     - PipelineView.tsx writes on a browser session, but it is an admin screen.
--   Reads stay open to members because the investor download routes
--   (documents/[id]/download, deals/[id]/om, deals/[id]/document/[type],
--   deals/[id]/package) all use createServerClient on the user's cookies, and
--   CitationDrawer / DealDetailClient mint signed URLs from the browser.
--
--   terminal-deal-photos and terminal-investor-photos stay PUBLIC buckets, so
--   getPublicUrl() keeps working everywhere -- those reads are served by the
--   public-object path and never consult these policies. What changes is who
--   may list or write the bucket.
--
-- Depends on: 20261019_terminal_security_lockdown_phase1.sql
-- ROLLBACK:   see the note above each section.

BEGIN;

-- == terminal-dd-documents: the data room ===================================
-- Reads: any invited user (interim -- see the F65 note above).
-- Writes: staff only.
--
-- ROLLBACK: recreate each with (bucket_id = '...' AND auth.role() = 'authenticated').
DROP POLICY IF EXISTS "Authenticated can view DD documents"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload DD documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update DD documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete DD documents" ON storage.objects;

CREATE POLICY "Members can view DD documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'terminal-dd-documents'
    AND public.terminal_user_role() IS NOT NULL
  );

CREATE POLICY "Staff can upload DD documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'terminal-dd-documents'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can update DD documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'terminal-dd-documents'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can delete DD documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'terminal-dd-documents'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

-- == terminal-investor-files: CRM attachments ===============================
-- Staff only, including reads: this bucket is never referenced anywhere under
-- src/components/portal or src/app/[locale]/(portal). It is an admin-side CRM
-- bucket (CrmDocumentsTab, CrmMessageForm) and nothing else.
--
-- ROLLBACK: recreate each with (bucket_id = '...' AND auth.role() = 'authenticated').
DROP POLICY IF EXISTS "Authenticated can view investor files"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload investor files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update investor files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete investor files" ON storage.objects;

CREATE POLICY "Staff can view investor files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'terminal-investor-files'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can upload investor files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'terminal-investor-files'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can update investor files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'terminal-investor-files'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can delete investor files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'terminal-investor-files'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

-- == terminal-investor-photos: CRM investor photos ==========================
-- Currently holds 0 objects, so there is nothing to break today -- but the
-- SELECT policy was USING (bucket_id = ...) with no auth test at all, i.e. open
-- to anon, and the writes were open to any signed-in account. Staff only.
-- The bucket stays public, so getPublicUrl() in CrmInvestorFormClient is
-- unaffected.
--
-- ROLLBACK: recreate "Public can view investor photos" with
--           USING (bucket_id = 'terminal-investor-photos') and the other three
--           with AND auth.role() = 'authenticated'.
DROP POLICY IF EXISTS "Public can view investor photos"         ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload investor photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update investor photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete investor photos" ON storage.objects;

CREATE POLICY "Staff can view investor photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'terminal-investor-photos'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can upload investor photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'terminal-investor-photos'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can update investor photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'terminal-investor-photos'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can delete investor photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'terminal-investor-photos'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

-- == terminal-deal-photos ===================================================
-- Phase 1 moved the SELECT policy from anon to any signed-in account, which
-- with open sign-up was a smaller win than it looked. Members only now, and
-- writes staff only. Every read in the app is getPublicUrl(), which does not
-- consult this policy, so nothing in the marketplace or the public deal pages
-- changes.
--
-- ROLLBACK: recreate with auth.role() = 'authenticated'.
DROP POLICY IF EXISTS "Authenticated can view deal photos"        ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload deal photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update deal photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete deal photos" ON storage.objects;

CREATE POLICY "Members can view deal photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'terminal-deal-photos'
    AND public.terminal_user_role() IS NOT NULL
  );

CREATE POLICY "Staff can upload deal photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'terminal-deal-photos'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can update deal photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'terminal-deal-photos'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

CREATE POLICY "Staff can delete deal photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'terminal-deal-photos'
    AND public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
  );

-- == terminal_settings: tighten phase 1 =====================================
-- Phase 1 used auth.uid() IS NOT NULL, which a self-signup satisfies. Require
-- an actual profile instead. The activity_webhook_% carve-out is unchanged.
--
-- ROLLBACK: recreate with auth.uid() IS NOT NULL in place of the role test.
DROP POLICY IF EXISTS "Everyone can read settings" ON public.terminal_settings;
CREATE POLICY "Everyone can read settings" ON public.terminal_settings
  FOR SELECT USING (
    terminal_user_role() IS NOT NULL
    AND (key NOT LIKE 'activity_webhook_%' OR terminal_user_role() = 'owner')
  );

-- == Verify inside the transaction ==========================================
DO $verify$
DECLARE
  v_bucket   text;
  v_cmd      text;
  v_n        int;
  v_txt      text;
  v_buckets  text[] := ARRAY['terminal-dd-documents','terminal-investor-files',
                             'terminal-investor-photos','terminal-deal-photos'];
BEGIN
  -- 1. Nothing on these four buckets may still pass on a bare session.
  SELECT count(*) INTO v_n
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND coalesce(qual,'')||coalesce(with_check,'') ~ 'terminal-(dd-documents|investor-files|investor-photos|deal-photos)'
    AND coalesce(qual,'')||coalesce(with_check,'') NOT LIKE '%terminal_user_role%';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Still % Terminal storage policies that do not test terminal_user_role().', v_n;
  END IF;

  -- 2. Every bucket must have exactly one policy per command, or a gap or a
  --    duplicate is hiding in here.
  FOREACH v_bucket IN ARRAY v_buckets LOOP
    FOREACH v_cmd IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      SELECT count(*) INTO v_n
      FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects' AND cmd=v_cmd
        AND coalesce(qual,'')||coalesce(with_check,'') LIKE '%'||v_bucket||'%';
      IF v_n <> 1 THEN
        RAISE EXCEPTION 'Bucket % has % policies for %, expected exactly 1.', v_bucket, v_n, v_cmd;
      END IF;
    END LOOP;
  END LOOP;

  -- 3. Writes on all four buckets must be staff-only.
  SELECT count(*) INTO v_n
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND cmd IN ('INSERT','UPDATE','DELETE')
    AND coalesce(qual,'')||coalesce(with_check,'') ~ 'terminal-(dd-documents|investor-files|investor-photos|deal-photos)'
    AND coalesce(qual,'')||coalesce(with_check,'') NOT LIKE '%employee%';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Found % Terminal storage write policies that are not staff-only.', v_n;
  END IF;

  -- 4. Investors must KEEP reading the data room, or the portal breaks.
  SELECT qual INTO v_txt FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects'
     AND policyname='Members can view DD documents';
  IF v_txt IS NULL OR v_txt LIKE '%employee%' THEN
    RAISE EXCEPTION 'The DD document read policy is missing or was made staff-only; investors would lose the data room.';
  END IF;

  -- 5. Settings must now require a profile, and keep the webhook carve-out.
  SELECT qual INTO v_txt FROM pg_policies
   WHERE schemaname='public' AND tablename='terminal_settings'
     AND policyname='Everyone can read settings';
  IF v_txt IS NULL OR position('terminal_user_role' IN v_txt) = 0 THEN
    RAISE EXCEPTION 'The settings read policy does not require a profile.';
  END IF;
  IF position('activity_webhook' IN v_txt) = 0 THEN
    RAISE EXCEPTION 'The settings read policy lost the webhook carve-out.';
  END IF;

  -- 6. The helper everything now depends on must stay callable, or every
  --    policy above fails closed and the data room goes dark.
  IF NOT has_function_privilege('authenticated','public.terminal_user_role()','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost EXECUTE on terminal_user_role(); every policy above would fail closed.';
  END IF;

  RAISE NOTICE 'Phase 1b verified: storage locked to invited users, writes staff-only, settings require a profile.';
END
$verify$;

COMMIT;

-- == STILL OPEN AFTER THIS ==================================================
-- F65 (full)  An invited investor can still read another deal's data-room
--             files. Scoping reads to visible document rows is the remaining
--             work and needs the per-deal visibility model.
-- F64b        /api/auth/create-profile still never checks expires_at.
--             40 unaccepted invites, all already expired, all redeemable.
-- F68         /api/onboarding/kyc must move to the service-role client BEFORE
--             a self-approval guard trigger can be added.
