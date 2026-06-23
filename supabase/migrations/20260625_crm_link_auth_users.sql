-- ============================================================================
-- Auto-link terminal_crm_investors.auth_user_id to terminal_users.id by email.
--
-- Two pieces:
--   1. One-time backfill for CRM rows that already match an existing user.
--   2. AFTER-INSERT trigger on terminal_users so future signups auto-link
--      regardless of which app code path creates the user (membership-app
--      approval, invite acceptance, anything else).
--
-- The reverse direction (CRM row created after the user already exists) is
-- handled in application code on every CRM insert / update / criteria submit
-- — see commitBulkInvestors / createInvestor / updateInvestor / api/criteria.
-- ============================================================================
-- ROLLBACK:
--   begin;
--   drop trigger if exists terminal_users_link_crm_investor on terminal_users;
--   drop function if exists link_crm_investor_to_user();
--   -- Backfill is not reversible (we don't track which rows the backfill set).
--   commit;

BEGIN;

-- ── 1. One-time backfill ────────────────────────────────────────────────────
-- Existing CRM rows whose email matches a terminal_users row get linked now.
-- Case-insensitive on both sides to match the lower(email) index from the
-- prior migration.
UPDATE public.terminal_crm_investors AS i
   SET auth_user_id = u.id
  FROM public.terminal_users AS u
 WHERE i.auth_user_id IS NULL
   AND i.email IS NOT NULL
   AND u.email IS NOT NULL
   AND lower(i.email) = lower(u.email);

-- ── 2. AFTER-INSERT trigger on terminal_users ───────────────────────────────
-- When a new auth user appears, link any unclaimed CRM row sharing the same
-- email. Skips rows that are already linked (to a different user_id — that
-- would imply two terminal_users with the same email, which auth wouldn't
-- allow anyway, but we guard defensively).
CREATE OR REPLACE FUNCTION public.link_crm_investor_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    UPDATE public.terminal_crm_investors
       SET auth_user_id = NEW.id
     WHERE auth_user_id IS NULL
       AND email IS NOT NULL
       AND lower(email) = lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS terminal_users_link_crm_investor ON public.terminal_users;
CREATE TRIGGER terminal_users_link_crm_investor
  AFTER INSERT ON public.terminal_users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_crm_investor_to_user();

COMMIT;
