-- 20261019_terminal_security_lockdown_phase3b_tier_fn_grant.sql
-- Corrects phase 3: lets anon call terminal_user_access_tier().
--
-- WHAT WENT WRONG
--   Phase 3 revoked EXECUTE on terminal_user_access_tier() from anon. But the two
--   terminal_deals policies that call it are evaluated for EVERY caller, anon
--   included -- Postgres does not promise to short-circuit on the
--   terminal_user_role() = 'investor' test first. So an anonymous read of
--   terminal_deals, or of any of the 22 child tables whose policies subquery it,
--   now fails with "permission denied for function terminal_user_access_tier"
--   instead of returning no rows. Found by probing production with the
--   publishable key right after phase 3 was applied.
--
--   Nothing leaked -- it is still a refusal -- and no page broke (the public
--   share page and login read through the service role). But "anon gets an empty
--   result" is the behaviour the rest of the app was built on.
--
-- WHY THE GRANT IS SAFE
--   For anon, auth.uid() is NULL, so the function returns NULL: no user, no
--   tier, nothing revealed. terminal_user_role() has always been executable by
--   anon for exactly this reason; this matches it.
--
-- Depends on: 20261019_terminal_security_lockdown_phase3_access_tier.sql
-- ROLLBACK:  REVOKE EXECUTE ON FUNCTION public.terminal_user_access_tier() FROM anon;

BEGIN;

GRANT EXECUTE ON FUNCTION public.terminal_user_access_tier() TO anon;

DO $verify$
BEGIN
  IF NOT has_function_privilege('anon', 'public.terminal_user_access_tier()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon still cannot execute terminal_user_access_tier().';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.terminal_user_access_tier()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost EXECUTE on terminal_user_access_tier(); every investor would be locked out of staged deals.';
  END IF;
END
$verify$;

COMMIT;
