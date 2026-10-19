-- 20261019_terminal_kyc_self_approval_guard.sql
-- Closes F68: investors could approve their own KYC, skipping the accreditation
-- check entirely.
--
-- !! DEPLOY ORDER MATTERS !!
--   The code change to src/app/api/onboarding/kyc/route.ts MUST be live before
--   this migration is applied. That route computes the accreditation decision
--   on the server but used to write it with the INVESTOR'S OWN session, relying
--   on the kyc_update_own policy. This migration takes that write away. Apply it
--   against a deployment that still has the old route and KYC onboarding breaks
--   for every investor mid-flow.
--
--   Correct order: merge + deploy the route change, confirm an investor can
--   still submit KYC, then apply this.
--
-- WHAT WAS WRONG
--   kyc_update_own was USING / WITH CHECK (user_id = auth.uid()) with no column
--   restriction, and terminal_user_kyc carries approved, approved_at and
--   approved_by. RLS cannot restrict columns, so "update your own row" meant
--   "decide your own accreditation". An investor could set approved = true by
--   posting straight to PostgREST, bypassing isAccredited() in the route.
--
-- WHAT THIS DOES
--   1. Drops the two self-write policies. After the route change nothing uses
--      them: the onboarding route writes with the service role, and the admin
--      approve/reject routes write as staff through kyc_update_admin. The
--      investor's own SELECT policy is untouched, so onboardingState.ts keeps
--      working and they still see their own status.
--   2. Adds a guard trigger as well, so re-adding a self-write policy later
--      cannot quietly reopen the hole. Belt and braces on purpose -- this is the
--      field that decides who is allowed to see deal economics.
--
-- WHO MAY STILL SET THE DECISION
--   - service role (auth.uid() IS NULL): the onboarding route, post-change.
--   - owner / employee: the admin review routes, which run on the reviewer's
--     own session.
--   Nobody else, including the investor the row belongs to.
--
-- Depends on: 20261019_terminal_security_lockdown_phase1.sql
-- ROLLBACK:
--   DROP TRIGGER terminal_kyc_guard_approval ON public.terminal_user_kyc;
--   CREATE POLICY "kyc_insert_own" ON public.terminal_user_kyc
--     FOR INSERT WITH CHECK (user_id = auth.uid());
--   CREATE POLICY "kyc_update_own" ON public.terminal_user_kyc
--     FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

BEGIN;

DROP POLICY IF EXISTS "kyc_insert_own" ON public.terminal_user_kyc;
DROP POLICY IF EXISTS "kyc_update_own" ON public.terminal_user_kyc;

CREATE OR REPLACE FUNCTION public.terminal_kyc_guard_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $guard$
DECLARE
  v_touches_decision boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- approved is NOT NULL DEFAULT false, so a plain submission is not a
    -- decision; only an affirmative one is.
    v_touches_decision :=
         new.approved         IS TRUE
      OR new.approved_at      IS NOT NULL
      OR new.approved_by      IS NOT NULL
      OR new.rejected_at      IS NOT NULL
      OR new.rejection_reason IS NOT NULL;
  ELSE
    v_touches_decision :=
         new.approved         IS DISTINCT FROM old.approved
      OR new.approved_at      IS DISTINCT FROM old.approved_at
      OR new.approved_by      IS DISTINCT FROM old.approved_by
      OR new.rejected_at      IS DISTINCT FROM old.rejected_at
      OR new.rejection_reason IS DISTINCT FROM old.rejection_reason;
  END IF;

  IF NOT v_touches_decision THEN
    RETURN new;
  END IF;

  -- No JWT: service-role callers. /api/onboarding/kyc runs here after the code
  -- change and derives the decision from isAccredited() on the submitted form.
  IF auth.uid() IS NULL THEN
    RETURN new;
  END IF;

  -- Staff reviewing KYC from the admin UI, on their own session.
  IF public.terminal_user_role() = ANY (ARRAY['owner'::text, 'employee'::text]) THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION
    'terminal_user_kyc: the approval decision cannot be set by this user'
    USING ERRCODE = '42501';
END;
$guard$;

DROP TRIGGER IF EXISTS terminal_kyc_guard_approval ON public.terminal_user_kyc;
CREATE TRIGGER terminal_kyc_guard_approval
  BEFORE INSERT OR UPDATE ON public.terminal_user_kyc
  FOR EACH ROW EXECUTE FUNCTION public.terminal_kyc_guard_approval();

-- == Verify inside the transaction ==========================================
DO $verify$
DECLARE
  v_n int;
BEGIN
  -- 1. The self-write policies must be gone.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='terminal_user_kyc'
     AND policyname IN ('kyc_insert_own','kyc_update_own');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'Self-write policies still present on terminal_user_kyc.';
  END IF;

  -- 2. The investor must KEEP reading their own row, or onboarding redirects
  --    into a loop.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='terminal_user_kyc'
                   AND policyname='kyc_select_own') THEN
    RAISE EXCEPTION 'kyc_select_own went missing; investors would lose their onboarding state.';
  END IF;

  -- 3. Staff must KEEP writing, or the admin review screen breaks.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='terminal_user_kyc'
                   AND policyname='kyc_update_admin') THEN
    RAISE EXCEPTION 'kyc_update_admin went missing; admin approve and reject would break.';
  END IF;

  -- 4. The guard must be live on both INSERT and UPDATE.
  SELECT count(*) INTO v_n FROM pg_trigger t
   JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname='terminal_user_kyc'
     AND t.tgname='terminal_kyc_guard_approval'
     AND t.tgenabled <> 'D'
     AND (t.tgtype & 4) > 0   -- INSERT
     AND (t.tgtype & 16) > 0; -- UPDATE
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'The KYC approval guard trigger is missing, disabled, or not on both INSERT and UPDATE.';
  END IF;

  RAISE NOTICE 'F68 closed: KYC approval is now settable only by the server or by staff.';
END
$verify$;

COMMIT;

-- == STILL OPEN AFTER THIS ==================================================
-- F65 (full)  An invited investor can still read another deal's data-room
--             files. Phase 1b removed the self-signup path; scoping reads to
--             visible document rows is the remaining work.
