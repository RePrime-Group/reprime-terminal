-- 20260609_investor_group_tabs.sql
-- Investor Group Tabs (Curated Deals) — Phase 1, data model + RLS.
--
-- An investor "group" (tab) is a named investment company (e.g. "RePrime").
-- Many terminal users are members of a group; deals are assigned to one or
-- more groups. A user sees a group's tab — and its deals, including off-market
-- ones — only if they are a member of that enabled group.
--
-- Three tables + a membership resolver + RLS. The terminal_deals policy added
-- here is ADDITIVE: RLS policies combine with OR, so it only grants extra read
-- access through a group assignment and never changes existing deal policies.
--
-- Style matches 002_terminal_rls.sql / 20260427_nda_kyc_marketplace_roles.sql:
-- terminal_user_role() for staff checks, DROP POLICY IF EXISTS before CREATE,
-- RLS enabled in the same migration, wrapped in a transaction.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. terminal_investor_tabs — the named group / investment company (the "tab").
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminal_investor_tabs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,                 -- admin-set display name, e.g. "RePrime"
  is_enabled  boolean NOT NULL DEFAULT true,
  hero_note   text,                          -- optional blurb shown atop the tab
  created_by  uuid REFERENCES public.terminal_users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.terminal_investor_tabs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. terminal_investor_tab_members — which users belong to which group (m:n).
--    No unique(user_id): a user may belong to more than one group.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminal_investor_tab_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id     uuid NOT NULL REFERENCES public.terminal_investor_tabs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.terminal_users(id) ON DELETE CASCADE,
  added_by   uuid REFERENCES public.terminal_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tab_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_terminal_investor_tab_members_user
  ON public.terminal_investor_tab_members (user_id);
CREATE INDEX IF NOT EXISTS idx_terminal_investor_tab_members_tab
  ON public.terminal_investor_tab_members (tab_id);

ALTER TABLE public.terminal_investor_tab_members ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. terminal_deal_tab_assignments — which groups a deal shows on (m:n).
--    UNIQUE (deal_id, tab_id) makes the admin assign a clean upsert/delete diff.
--    'suggested' status is reserved for the Phase 3 AI matcher.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminal_deal_tab_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       uuid NOT NULL REFERENCES public.terminal_deals(id) ON DELETE CASCADE,
  tab_id        uuid NOT NULL REFERENCES public.terminal_investor_tabs(id) ON DELETE CASCADE,
  assigned_by   uuid REFERENCES public.terminal_users(id),
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'hidden', 'suggested')),
  match_reason  text,    -- optional, investor-visible
  internal_note text,    -- optional, admin-only
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, tab_id)
);

CREATE INDEX IF NOT EXISTS idx_terminal_deal_tab_assignments_tab_status
  ON public.terminal_deal_tab_assignments (tab_id, status);
CREATE INDEX IF NOT EXISTS idx_terminal_deal_tab_assignments_deal
  ON public.terminal_deal_tab_assignments (deal_id);

ALTER TABLE public.terminal_deal_tab_assignments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. Membership resolver — returns the tab ids a user belongs to.
--    SECURITY DEFINER so membership lookups inside other tables' policies do
--    not recurse through RLS. search_path pinned for safety.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.terminal_user_tab_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tab_id FROM public.terminal_investor_tab_members WHERE user_id = uid;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS — terminal_investor_tabs
-- ---------------------------------------------------------------------------
-- Member reads only enabled groups they belong to.
DROP POLICY IF EXISTS "member reads own groups" ON public.terminal_investor_tabs;
CREATE POLICY "member reads own groups" ON public.terminal_investor_tabs
  FOR SELECT USING (
    is_enabled = true
    AND id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
  );

-- Staff full control.
DROP POLICY IF EXISTS "staff manage groups" ON public.terminal_investor_tabs;
CREATE POLICY "staff manage groups" ON public.terminal_investor_tabs
  FOR ALL USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

-- ---------------------------------------------------------------------------
-- 6. RLS — terminal_investor_tab_members
-- ---------------------------------------------------------------------------
-- User reads only their own membership rows (cannot enumerate co-members).
DROP POLICY IF EXISTS "user reads own memberships" ON public.terminal_investor_tab_members;
CREATE POLICY "user reads own memberships" ON public.terminal_investor_tab_members
  FOR SELECT USING (user_id = auth.uid());

-- Staff full control.
DROP POLICY IF EXISTS "staff manage memberships" ON public.terminal_investor_tab_members;
CREATE POLICY "staff manage memberships" ON public.terminal_investor_tab_members
  FOR ALL USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

-- ---------------------------------------------------------------------------
-- 7. RLS — terminal_deal_tab_assignments
-- ---------------------------------------------------------------------------
-- Member reads active assignments for groups they belong to.
DROP POLICY IF EXISTS "member reads group assignments" ON public.terminal_deal_tab_assignments;
CREATE POLICY "member reads group assignments" ON public.terminal_deal_tab_assignments
  FOR SELECT USING (
    status = 'active'
    AND tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
  );

-- Staff full control.
DROP POLICY IF EXISTS "staff manage assignments" ON public.terminal_deal_tab_assignments;
CREATE POLICY "staff manage assignments" ON public.terminal_deal_tab_assignments
  FOR ALL USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

-- ---------------------------------------------------------------------------
-- 8. RLS — terminal_deals ADDITIVE curated-read policy.
--    Grants read through an active assignment to an enabled group the user
--    belongs to, so off-market / coming_soon curated deals become visible.
--    Combines with OR alongside the existing terminal_deals SELECT policies
--    (002_terminal_rls.sql, 20260427_nda_kyc_marketplace_roles.sql) — those
--    are NOT modified. Disabling a group (is_enabled = false) revokes this.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "member reads curated deals" ON public.terminal_deals;
CREATE POLICY "member reads curated deals" ON public.terminal_deals
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.terminal_deal_tab_assignments a
      JOIN public.terminal_investor_tabs t ON t.id = a.tab_id
      WHERE a.deal_id = terminal_deals.id
        AND a.status = 'active'
        AND t.is_enabled = true
        AND a.tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
    )
  );

COMMIT;
