-- 20261019_terminal_security_lockdown_phase2_storage_scope.sql
-- Closes the rest of F65: an invited investor could read EVERY data-room file,
-- including files on deals they cannot see.
--
-- WHAT WAS WRONG
--   Phase 1b limited reads of terminal-dd-documents to "has a terminal_users
--   row". That stopped self-signups, but any invited investor could still sign
--   a URL for any of the 3,311 files -- up to 1,333 of them sit on draft,
--   under-review or group-only deals. The website never lists those files, but
--   storage did not check, so anyone holding a login could fetch them directly.
--
-- WHAT THIS DOES
--   A file is readable when the caller can see a document row pointing at it:
--
--     EXISTS (SELECT 1 FROM terminal_dd_documents d
--             WHERE d.storage_path = storage.objects.name)
--
--   That subquery runs with the CALLER's permissions, so the documents table's
--   own RLS decides the answer. Storage therefore follows exactly the rule the
--   website already uses to list the data room (deal stage, marketplace, curated
--   group membership) and cannot drift from it: change the documents rule and
--   storage follows automatically. Staff keep reading every file, including the
--   44 with no document row (extraction temp files and deleted-document orphans).
--
-- WHY THIS IS SAFE
--   Every investor download path already goes through a document row on the
--   investor's own session: /api/documents/[id]/download, /api/deals/[id]/om,
--   /api/deals/[id]/document/[type], /api/deals/[id]/package, plus the data room
--   and the AI citation drawer, which read terminal_dd_documents and then sign
--   that row's storage_path. terminal_deals stores no file paths (dropped in
--   20260724_drop_legacy_file_columns.sql). n8n uses the service role and is
--   unaffected.
--
-- PERFORMANCE
--   The existing unique index is (deal_id, storage_path), which cannot serve a
--   lookup by storage_path alone, so one is added.
--
-- Depends on: 20261019_terminal_security_lockdown_phase1b.sql
-- ROLLBACK:
--   DROP POLICY "Visible DD documents" ON storage.objects;
--   CREATE POLICY "Members can view DD documents" ON storage.objects
--     FOR SELECT USING (bucket_id = 'terminal-dd-documents'
--                       AND public.terminal_user_role() IS NOT NULL);
--   (The index is harmless to keep.)

BEGIN;

CREATE INDEX IF NOT EXISTS terminal_dd_documents_storage_path_idx
  ON public.terminal_dd_documents (storage_path);

DROP POLICY IF EXISTS "Members can view DD documents" ON storage.objects;
CREATE POLICY "Visible DD documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'terminal-dd-documents'
    AND (
      public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text])
      OR EXISTS (
        -- storage.objects.name must be qualified: terminal_dd_documents has a
        -- `name` column of its own, which would silently win inside here.
        SELECT 1 FROM public.terminal_dd_documents d
        WHERE d.storage_path = storage.objects.name
      )
    )
  );

-- == Verify inside the transaction ==========================================
DO $verify$
DECLARE
  v_n        int;
  v_qual     text;
  v_investor uuid;
  v_expected bigint;
  v_actual   bigint;
  v_total    bigint;
BEGIN
  -- 1. Shape: exactly one SELECT policy on the bucket, and it is the new one.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects' AND cmd='SELECT'
     AND qual LIKE '%terminal-dd-documents%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 SELECT policy on terminal-dd-documents, found %.', v_n;
  END IF;

  SELECT qual INTO v_qual FROM pg_policies
   WHERE schemaname='storage' AND tablename='objects' AND policyname='Visible DD documents';
  IF v_qual IS NULL OR position('storage_path' IN v_qual) = 0 THEN
    RAISE EXCEPTION 'The new data-room read policy is missing or does not check document rows.';
  END IF;
  IF position('objects.name' IN v_qual) = 0 THEN
    RAISE EXCEPTION 'The policy compares storage_path to an unqualified name; it would match the wrong column.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                  AND indexname='terminal_dd_documents_storage_path_idx') THEN
    RAISE EXCEPTION 'storage_path index was not created.';
  END IF;

  -- 2. Live: an investor must see exactly the files the documents rule allows.
  --    Picks the full-tier investor in the most groups, so the curated path is
  --    exercised too. Best effort: not every connection may SET ROLE.
  SELECT u.id INTO v_investor
  FROM public.terminal_users u
  LEFT JOIN public.terminal_investor_tab_members m ON m.user_id = u.id
  WHERE u.role = 'investor' AND u.access_tier IS DISTINCT FROM 'marketplace_only'
  GROUP BY u.id ORDER BY count(m.user_id) DESC, u.id LIMIT 1;

  SELECT count(*) INTO v_total FROM storage.objects WHERE bucket_id='terminal-dd-documents';

  SELECT count(*) INTO v_expected
  FROM storage.objects o
  WHERE o.bucket_id = 'terminal-dd-documents'
    AND EXISTS (
      SELECT 1 FROM public.terminal_dd_documents d
      JOIN public.terminal_deals t ON t.id = d.deal_id
      WHERE d.storage_path = o.name
        AND (
          t.status IN ('marketplace','coming_soon','loi_signed','pending_final_loi',
                       'psa_signed','published','assigned','closed','cancelled')
          OR (t.status <> 'draft' AND d.deal_id IN (
                SELECT a.deal_id FROM public.terminal_deal_tab_assignments a
                JOIN public.terminal_investor_tabs tt ON tt.id = a.tab_id
                WHERE a.status = 'active' AND tt.is_enabled
                  AND a.tab_id IN (SELECT public.terminal_user_tab_ids(v_investor))))
        ));

  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_investor, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_actual FROM storage.objects WHERE bucket_id='terminal-dd-documents';
    RESET ROLE;

    IF v_actual = 0 THEN
      RAISE EXCEPTION 'Investor sees 0 data-room files: the data room would go dark.';
    END IF;
    IF v_actual >= v_total THEN
      RAISE EXCEPTION 'Investor still sees all % data-room files: the scope is not applied.', v_total;
    END IF;
    IF v_actual <> v_expected THEN
      RAISE EXCEPTION 'Investor sees % files but the documents rule allows %.', v_actual, v_expected;
    END IF;
    RAISE NOTICE 'Verified live: investor sees % of % data-room files, exactly as expected.', v_actual, v_total;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RAISE NOTICE 'SET ROLE not permitted here; impersonation skipped. Expected % of % for investor %.',
        v_expected, v_total, v_investor;
  END;
END
$verify$;

COMMIT;
