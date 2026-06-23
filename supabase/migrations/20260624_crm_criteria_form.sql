-- ============================================================================
-- Investor Criteria Form + Mandates
-- One migration covers: token columns on terminal_crm_investors, new mandates
-- table, new form-sends audit table, JSONB → mandates data migration, drop of
-- the legacy investment_preferences column, updated summary view.
--
-- Depends on: terminal_user_role() (002_terminal_rls.sql),
--             terminal_crm_investors / terminal_crm_messages (20260523_crm_*),
--             terminal_crm_investor_summary view (20260523_crm_summary_view.sql).
--
-- NOTE on order: the existing summary view selects i.* from terminal_crm_investors,
-- which pins the investment_preferences column. The view must be dropped BEFORE
-- the column can be dropped — done in step 4 below.
-- ============================================================================
-- ROLLBACK:
--   begin;
--   drop view if exists terminal_crm_investor_summary;
--   drop table if exists terminal_crm_form_sends;
--   drop trigger if exists terminal_crm_mandates_updated_at on terminal_crm_mandates;
--   drop function if exists set_terminal_crm_mandates_updated_at();
--   drop table if exists terminal_crm_mandates;
--   alter table terminal_crm_investors
--     add column investment_preferences jsonb not null default '{}'::jsonb,
--     drop column timeline_to_deploy,
--     drop column ownership_pref,
--     drop column capital_ready,
--     drop column investing_as,
--     drop column consent_contact,
--     drop column managed_by,
--     drop column auth_user_id,
--     drop column criteria_submitted_at,
--     drop column form_last_sent_at,
--     drop column submission_token_issued_at,
--     drop column submission_token;
--   -- then re-run the original 20260523_crm_summary_view.sql to restore the prior view.
--   commit;

BEGIN;

-- ── 1. Extend terminal_crm_investors ────────────────────────────────────────
ALTER TABLE public.terminal_crm_investors
  ADD COLUMN submission_token            text UNIQUE,
  ADD COLUMN submission_token_issued_at  timestamptz,
  ADD COLUMN form_last_sent_at           timestamptz,
  ADD COLUMN criteria_submitted_at       timestamptz,
  ADD COLUMN auth_user_id                uuid REFERENCES public.terminal_users(id),
  ADD COLUMN managed_by                  uuid REFERENCES public.terminal_users(id),
  ADD COLUMN consent_contact             boolean NOT NULL DEFAULT false,
  ADD COLUMN investing_as                text CHECK (investing_as IN ('principal','fund','family_office','jv','1031')) NULL,
  ADD COLUMN capital_ready               text NULL,
  ADD COLUMN ownership_pref              text CHECK (ownership_pref IN ('direct','gp_lp','either')) NULL,
  ADD COLUMN timeline_to_deploy          text NULL;

CREATE UNIQUE INDEX idx_crm_investors_submission_token
  ON public.terminal_crm_investors (submission_token)
  WHERE submission_token IS NOT NULL;

CREATE INDEX idx_crm_investors_email_lower
  ON public.terminal_crm_investors (lower(email));

CREATE INDEX idx_crm_investors_auth_user
  ON public.terminal_crm_investors (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- ── 2. terminal_crm_mandates ────────────────────────────────────────────────
CREATE TABLE public.terminal_crm_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL REFERENCES public.terminal_crm_investors(id) ON DELETE CASCADE,

  label text,
  color text,
  is_active boolean NOT NULL DEFAULT true,

  property_types  text[] NOT NULL DEFAULT '{}',
  listing_types   text[] NOT NULL DEFAULT '{}',
  states          text[] NOT NULL DEFAULT '{}',
  property_class  text[] NOT NULL DEFAULT '{}',
  structure_prefs text[] NOT NULL DEFAULT '{}',

  min_price            numeric(15,2),
  max_price            numeric(15,2),
  min_cap              numeric(6,3),
  min_coc              numeric(6,3),
  min_occupancy        numeric(5,2),
  max_occupancy        numeric(5,2),
  min_sqft             numeric(12,0),
  max_sqft             numeric(12,0),
  price_per_sf_max     numeric(10,2),
  min_lease_term_years numeric(5,2),

  strategy text CHECK (strategy IN ('value_add','stabilized','opportunistic','either')) NULL,
  tenant_credit_pref text CHECK (tenant_credit_pref IN ('investment_grade','mixed','not_important')) NULL,
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_mandates_investor ON public.terminal_crm_mandates (investor_id);
CREATE INDEX idx_crm_mandates_active   ON public.terminal_crm_mandates (investor_id) WHERE is_active;

CREATE OR REPLACE FUNCTION set_terminal_crm_mandates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS terminal_crm_mandates_updated_at ON public.terminal_crm_mandates;
CREATE TRIGGER terminal_crm_mandates_updated_at
  BEFORE UPDATE ON public.terminal_crm_mandates
  FOR EACH ROW EXECUTE FUNCTION set_terminal_crm_mandates_updated_at();

ALTER TABLE public.terminal_crm_mandates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_mandates_staff_all" ON public.terminal_crm_mandates;
CREATE POLICY "crm_mandates_staff_all"
  ON public.terminal_crm_mandates
  FOR ALL
  USING (terminal_user_role() IN ('owner','employee'))
  WITH CHECK (terminal_user_role() IN ('owner','employee'));

-- ── 3. terminal_crm_form_sends (audit) ──────────────────────────────────────
CREATE TABLE public.terminal_crm_form_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL REFERENCES public.terminal_crm_investors(id) ON DELETE CASCADE,
  submission_token text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES public.terminal_users(id),
  resend_message_id text,
  subject text,
  delivery_status text NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent','failed','bounced'))
);
CREATE INDEX idx_crm_form_sends_investor ON public.terminal_crm_form_sends (investor_id, sent_at DESC);

ALTER TABLE public.terminal_crm_form_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_form_sends_staff_all" ON public.terminal_crm_form_sends;
CREATE POLICY "crm_form_sends_staff_all"
  ON public.terminal_crm_form_sends
  FOR ALL
  USING (terminal_user_role() IN ('owner','employee'))
  WITH CHECK (terminal_user_role() IN ('owner','employee'));

-- ── 4. Drop the legacy summary view (it depends on investment_preferences) ─
DROP VIEW IF EXISTS public.terminal_crm_investor_summary;

-- ── 5. Data migration: JSONB investment_preferences → mandates rows ─────────
-- Only 2 rows in prod; insert one mandate per investor whose JSONB is non-empty.
INSERT INTO public.terminal_crm_mandates (
  investor_id, label, is_active,
  property_types, states, structure_prefs,
  min_price, max_price, min_cap, min_coc,
  min_sqft, max_sqft, price_per_sf_max, min_lease_term_years,
  strategy, tenant_credit_pref, notes
)
SELECT
  i.id,
  'Migrated preferences',
  true,
  CASE
    WHEN jsonb_typeof(i.investment_preferences -> 'property_types') = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(i.investment_preferences -> 'property_types'))
    ELSE '{}'::text[]
  END,
  CASE
    WHEN jsonb_typeof(i.investment_preferences -> 'markets') = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(i.investment_preferences -> 'markets'))
    ELSE '{}'::text[]
  END,
  CASE
    WHEN jsonb_typeof(i.investment_preferences -> 'structure_preferences') = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(i.investment_preferences -> 'structure_preferences'))
    ELSE '{}'::text[]
  END,
  NULLIF(i.investment_preferences ->> 'min_check_size', '')::numeric(15,2),
  NULLIF(i.investment_preferences ->> 'max_check_size', '')::numeric(15,2),
  NULL::numeric(6,3),  -- legacy JSONB didn't carry min_cap
  NULL::numeric(6,3),
  NULL::numeric(12,0),
  NULL::numeric(12,0),
  NULL::numeric(10,2),
  NULL::numeric(5,2),
  CASE i.investment_preferences ->> 'priority'
    WHEN 'cash_flow'     THEN 'stabilized'
    WHEN 'appreciation'  THEN 'value_add'
    WHEN 'balanced'      THEN 'either'
    ELSE NULL
  END,
  NULL::text,
  NULLIF(i.investment_preferences ->> 'hold_period_years', '')
FROM public.terminal_crm_investors i
WHERE jsonb_typeof(i.investment_preferences) = 'object'
  AND i.investment_preferences <> '{}'::jsonb;

-- ── 6. Drop the legacy JSONB column (now unblocked by view drop above) ─────
ALTER TABLE public.terminal_crm_investors DROP COLUMN investment_preferences;

-- ── 7. Recreate the summary view with derived lifecycle_state + mandate_count
CREATE VIEW public.terminal_crm_investor_summary
WITH (security_invoker = true) AS
SELECT
  i.*,
  (i.first_name || ' ' || i.last_name) AS full_name,
  CASE
    WHEN i.auth_user_id IS NOT NULL           THEN 'active'
    WHEN i.criteria_submitted_at IS NOT NULL  THEN 'submitted'
    WHEN i.submission_token IS NOT NULL       THEN 'invited'
    ELSE                                           'lead'
  END AS lifecycle_state,
  (SELECT COUNT(*) FROM public.terminal_crm_mandates m
     WHERE m.investor_id = i.id AND m.is_active) AS mandate_count,
  (SELECT COUNT(*) FROM public.terminal_crm_messages m
     WHERE m.investor_id = i.id) AS message_count,
  (SELECT MAX(m.created_at) FROM public.terminal_crm_messages m
     WHERE m.investor_id = i.id) AS last_message_at,
  (SELECT COALESCE(SUM(m.commitment_amount), 0) FROM public.terminal_crm_messages m
     WHERE m.investor_id = i.id AND m.commitment_amount IS NOT NULL) AS total_commitments,
  (SELECT COUNT(*) FROM public.terminal_crm_messages m
     WHERE m.investor_id = i.id
       AND m.follow_up_date IS NOT NULL
       AND m.follow_up_completed = FALSE) AS pending_follow_up_count,
  (SELECT COUNT(*) FROM public.terminal_crm_messages m
     WHERE m.investor_id = i.id AND m.is_pinned = TRUE) AS pinned_count
FROM public.terminal_crm_investors i
WHERE i.is_archived = FALSE;

COMMIT;
