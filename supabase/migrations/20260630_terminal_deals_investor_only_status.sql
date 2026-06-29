-- 20260630_terminal_deals_investor_only_status.sql
-- Adds a new `investor_only` value to terminal_deals.status — a visibility
-- mode for deals that belong to specific investor groups (curated tabs) and
-- should NOT appear in the public marketplace.
--
-- Behavior summary:
--   • Whenever a deal gains an active group assignment, if its status is a
--     "discovery" status (marketplace / coming_soon), flip it to
--     investor_only. Drafts stay draft (invisible). Pipeline statuses
--     (loi_signed / under_review / assigned / closed / published / cancelled)
--     are NOT touched — they carry workflow state and must survive.
--   • The status itself doesn't gate curated-tab visibility — the existing
--     curated page filter (status != 'draft') already does that.
--   • Removing the last group assignment does NOT revert status. An admin
--     can flip it back manually via /admin/deals if needed.
--
-- BACKFILL IMPACT (run at 2026-06-30):
--   46 marketplace deals currently have active group assignments. They will
--   flip to investor_only and disappear from the public marketplace.
--   1 cancelled, 1 draft, 1 published — untouched.
--
-- RLS:
--   The existing curated SELECT policy on terminal_deals already permits row
--   access through a group assignment regardless of status. To make the
--   deal-detail page render correctly, the same group-aware visibility is
--   extended to every per-deal table the page reads:
--     • terminal_deal_photos, terminal_dd_folders, terminal_dd_documents
--     • terminal_deal_addresses (portfolio breakdown)
--     • tenant_leases, capex_items, exit_scenarios
--     • terminal_deal_insights
--   Each table gets two new additive policies:
--     1. "<table> investor curated read" — non-draft deal + investor has an
--        active group assignment to that deal.
--     2. "<table> investor marketplace read" — status = 'marketplace'. This
--        closes a pre-existing gap: today these per-deal tables are invisible
--        to investors for marketplace deals (the marketplace status was
--        added in 20260427 but the policies on these tables predate it and
--        were never extended). Same pattern as the marketplace policies
--        for photos/folders/documents from 20260427.
--
-- Depends on: 001_terminal_tables.sql (terminal_deals),
--             20260427_nda_kyc_marketplace_roles.sql (existing status enum),
--             20260609_investor_group_tabs.sql (terminal_deal_tab_assignments,
--                                               terminal_user_tab_ids()).

-- ROLLBACK:
--   begin;
--   drop policy if exists "deal_insights_investor_marketplace_read" on public.terminal_deal_insights;
--   drop policy if exists "deal_insights_investor_curated_read"    on public.terminal_deal_insights;
--   drop policy if exists "exit_scenarios_investor_marketplace_read" on public.exit_scenarios;
--   drop policy if exists "exit_scenarios_investor_curated_read"    on public.exit_scenarios;
--   drop policy if exists "capex_items_investor_marketplace_read"   on public.capex_items;
--   drop policy if exists "capex_items_investor_curated_read"       on public.capex_items;
--   drop policy if exists "tenant_leases_investor_marketplace_read" on public.tenant_leases;
--   drop policy if exists "tenant_leases_investor_curated_read"     on public.tenant_leases;
--   drop policy if exists "Investors view marketplace addresses"    on public.terminal_deal_addresses;
--   drop policy if exists "Investors view curated addresses"        on public.terminal_deal_addresses;
--   drop policy if exists "Investors view curated deal documents"   on public.terminal_dd_documents;
--   drop policy if exists "Investors view curated deal folders"     on public.terminal_dd_folders;
--   drop policy if exists "Investors view curated deal photos"      on public.terminal_deal_photos;
--   drop trigger if exists trg_bump_to_investor_only on public.terminal_deal_tab_assignments;
--   drop function if exists public.bump_to_investor_only();
--   -- The status enum widening is left in place — narrowing it would fail if
--   -- any rows still have investor_only. To revert: first migrate those rows
--   -- back to marketplace (or wherever), then re-add the old CHECK constraint.
--   commit;

BEGIN;

-- ── 1. Widen the status CHECK constraint ───────────────────────────────────
ALTER TABLE public.terminal_deals
  DROP CONSTRAINT IF EXISTS terminal_deals_status_check;
ALTER TABLE public.terminal_deals
  ADD CONSTRAINT terminal_deals_status_check
    CHECK (status IN (
      'draft',
      'coming_soon',
      'marketplace',
      'investor_only',
      'loi_signed',
      'published',
      'under_review',
      'assigned',
      'closed',
      'cancelled'
    ));

-- ── 2. Backfill: marketplace/coming_soon deals with active assignments ─────
UPDATE public.terminal_deals d
SET status = 'investor_only', updated_at = now()
WHERE d.status IN ('marketplace', 'coming_soon')
  AND EXISTS (
    SELECT 1 FROM public.terminal_deal_tab_assignments a
    WHERE a.deal_id = d.id AND a.status = 'active'
  );

-- ── 3. Auto-flip trigger on tab assignment INSERT ──────────────────────────
-- SECURITY DEFINER so it can update terminal_deals regardless of who created
-- the assignment row (admin via UI, the sourcing promote action, future
-- automation). search_path pinned for safety, same as terminal_user_tab_ids.
CREATE OR REPLACE FUNCTION public.bump_to_investor_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Only act on rows that actually take effect.
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  UPDATE public.terminal_deals
  SET status = 'investor_only', updated_at = now()
  WHERE id = NEW.deal_id
    AND status IN ('marketplace', 'coming_soon');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_to_investor_only ON public.terminal_deal_tab_assignments;
CREATE TRIGGER trg_bump_to_investor_only
  AFTER INSERT ON public.terminal_deal_tab_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_to_investor_only();

-- ── 4. RLS — investor read access to curated deal assets ────────────────────
-- Permits reading deal photos / folders / documents for any non-draft deal
-- the investor has curated-tab access to. Mirrors the marketplace policies
-- in 20260427 (additive — does not modify them).
DROP POLICY IF EXISTS "Investors view curated deal photos" ON public.terminal_deal_photos;
CREATE POLICY "Investors view curated deal photos" ON public.terminal_deal_photos
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT a.deal_id
      FROM public.terminal_deal_tab_assignments a
      JOIN public.terminal_investor_tabs t ON t.id = a.tab_id
      WHERE a.status = 'active'
        AND t.is_enabled = true
        AND a.tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
    )
    AND deal_id IN (
      SELECT id FROM public.terminal_deals WHERE status <> 'draft'
    )
  );

DROP POLICY IF EXISTS "Investors view curated deal folders" ON public.terminal_dd_folders;
CREATE POLICY "Investors view curated deal folders" ON public.terminal_dd_folders
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT a.deal_id
      FROM public.terminal_deal_tab_assignments a
      JOIN public.terminal_investor_tabs t ON t.id = a.tab_id
      WHERE a.status = 'active'
        AND t.is_enabled = true
        AND a.tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
    )
    AND deal_id IN (
      SELECT id FROM public.terminal_deals WHERE status <> 'draft'
    )
  );

DROP POLICY IF EXISTS "Investors view curated deal documents" ON public.terminal_dd_documents;
CREATE POLICY "Investors view curated deal documents" ON public.terminal_dd_documents
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT a.deal_id
      FROM public.terminal_deal_tab_assignments a
      JOIN public.terminal_investor_tabs t ON t.id = a.tab_id
      WHERE a.status = 'active'
        AND t.is_enabled = true
        AND a.tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
    )
    AND deal_id IN (
      SELECT id FROM public.terminal_deals WHERE status <> 'draft'
    )
  );

-- ── 5. RLS — investor read on per-deal data tables ─────────────────────────
-- Five additional tables whose existing investor read policies (written
-- between 20260323 and 20260629) only allow status IN ('coming_soon',
-- 'loi_signed', 'published', 'assigned', 'closed') — missing both
-- 'marketplace' (pre-existing gap) and 'investor_only' (new).
--
-- For each table: add a curated-group policy (any non-draft deal the
-- investor has group access to) AND a marketplace policy (status =
-- 'marketplace' for any investor). Both ADDITIVE — existing policies are
-- left untouched and combine with OR.

-- ----- terminal_deal_addresses -----
DROP POLICY IF EXISTS "Investors view curated addresses" ON public.terminal_deal_addresses;
CREATE POLICY "Investors view curated addresses" ON public.terminal_deal_addresses
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT a.deal_id
      FROM public.terminal_deal_tab_assignments a
      JOIN public.terminal_investor_tabs t ON t.id = a.tab_id
      WHERE a.status = 'active'
        AND t.is_enabled = true
        AND a.tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
    )
    AND deal_id IN (
      SELECT id FROM public.terminal_deals WHERE status <> 'draft'
    )
  );

DROP POLICY IF EXISTS "Investors view marketplace addresses" ON public.terminal_deal_addresses;
CREATE POLICY "Investors view marketplace addresses" ON public.terminal_deal_addresses
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (SELECT id FROM public.terminal_deals WHERE status = 'marketplace')
  );

-- ----- tenant_leases -----
DROP POLICY IF EXISTS "tenant_leases_investor_curated_read" ON public.tenant_leases;
CREATE POLICY "tenant_leases_investor_curated_read" ON public.tenant_leases
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT a.deal_id
      FROM public.terminal_deal_tab_assignments a
      JOIN public.terminal_investor_tabs t ON t.id = a.tab_id
      WHERE a.status = 'active'
        AND t.is_enabled = true
        AND a.tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
    )
    AND deal_id IN (
      SELECT id FROM public.terminal_deals WHERE status <> 'draft'
    )
  );

DROP POLICY IF EXISTS "tenant_leases_investor_marketplace_read" ON public.tenant_leases;
CREATE POLICY "tenant_leases_investor_marketplace_read" ON public.tenant_leases
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (SELECT id FROM public.terminal_deals WHERE status = 'marketplace')
  );

-- ----- capex_items -----
DROP POLICY IF EXISTS "capex_items_investor_curated_read" ON public.capex_items;
CREATE POLICY "capex_items_investor_curated_read" ON public.capex_items
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT a.deal_id
      FROM public.terminal_deal_tab_assignments a
      JOIN public.terminal_investor_tabs t ON t.id = a.tab_id
      WHERE a.status = 'active'
        AND t.is_enabled = true
        AND a.tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
    )
    AND deal_id IN (
      SELECT id FROM public.terminal_deals WHERE status <> 'draft'
    )
  );

DROP POLICY IF EXISTS "capex_items_investor_marketplace_read" ON public.capex_items;
CREATE POLICY "capex_items_investor_marketplace_read" ON public.capex_items
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (SELECT id FROM public.terminal_deals WHERE status = 'marketplace')
  );

-- ----- exit_scenarios -----
DROP POLICY IF EXISTS "exit_scenarios_investor_curated_read" ON public.exit_scenarios;
CREATE POLICY "exit_scenarios_investor_curated_read" ON public.exit_scenarios
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT a.deal_id
      FROM public.terminal_deal_tab_assignments a
      JOIN public.terminal_investor_tabs t ON t.id = a.tab_id
      WHERE a.status = 'active'
        AND t.is_enabled = true
        AND a.tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
    )
    AND deal_id IN (
      SELECT id FROM public.terminal_deals WHERE status <> 'draft'
    )
  );

DROP POLICY IF EXISTS "exit_scenarios_investor_marketplace_read" ON public.exit_scenarios;
CREATE POLICY "exit_scenarios_investor_marketplace_read" ON public.exit_scenarios
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (SELECT id FROM public.terminal_deals WHERE status = 'marketplace')
  );

-- ----- terminal_deal_insights -----
DROP POLICY IF EXISTS "deal_insights_investor_curated_read" ON public.terminal_deal_insights;
CREATE POLICY "deal_insights_investor_curated_read" ON public.terminal_deal_insights
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT a.deal_id
      FROM public.terminal_deal_tab_assignments a
      JOIN public.terminal_investor_tabs t ON t.id = a.tab_id
      WHERE a.status = 'active'
        AND t.is_enabled = true
        AND a.tab_id IN (SELECT public.terminal_user_tab_ids(auth.uid()))
    )
    AND deal_id IN (
      SELECT id FROM public.terminal_deals WHERE status <> 'draft'
    )
  );

DROP POLICY IF EXISTS "deal_insights_investor_marketplace_read" ON public.terminal_deal_insights;
CREATE POLICY "deal_insights_investor_marketplace_read" ON public.terminal_deal_insights
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (SELECT id FROM public.terminal_deals WHERE status = 'marketplace')
  );

COMMIT;
