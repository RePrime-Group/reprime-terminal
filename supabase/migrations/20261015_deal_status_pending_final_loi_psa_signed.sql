-- 20261015_deal_status_pending_final_loi_psa_signed.sql
-- Adds two new pipeline values to terminal_deals.status:
--   • pending_final_loi — "Pending Final LOI"
--   • psa_signed        — "PSA Signed"
--
-- These sit between the existing `loi_signed` and `assigned` stages. Together
-- with `published` and `loi_signed` they form the "active" family — a deal
-- that is live in front of investors. Anywhere the app previously counted or
-- filtered on `published` alone now covers all four (see ACTIVE_DEAL_STATUSES
-- in src/lib/constants.ts).
--
-- WHY THE RLS CHURN:
--   Investor visibility is gated by 13 policies across 10 tables, each of
--   which hardcodes the list of statuses an investor may see. Widening the
--   CHECK constraint alone would let an admin SET the new statuses, but the
--   deal would then vanish from the investor dashboard and its detail page
--   would render with no photos, documents, rent roll, capex, exit scenarios,
--   insights or AI chat. Every one of those policies is recreated below with
--   the two new values inserted after 'loi_signed'.
--
--   The policies are NOT uniform and are reproduced faithfully rather than
--   normalised:
--     • terminal_deal_addresses has no terminal_user_role() check at all.
--     • terminal_deal_insights, terminal_ai_conversations (x3) omit 'cancelled'.
--     • terminal_activity_log omits 'cancelled' but includes 'marketplace'.
--   Changing any of those would be a visibility change beyond this migration.
--
-- NOT CHANGED (deliberate):
--   • The curated-tab and marketplace policies from 20260630 — they key off
--     group assignment / 'marketplace', not the pipeline status list.
--   • Public teaser visibility (src/app/[locale]/deal/[id]/page.tsx) — a deal
--     at PSA stage stays out of public links.
--
-- Depends on: 001_terminal_tables.sql, 20260427_nda_kyc_marketplace_roles.sql,
--             20260430_cancelled_deal_status.sql,
--             20260630_terminal_deals_investor_only_status.sql
--
-- ROLLBACK:
--   Re-run this file with 'pending_final_loi' and 'psa_signed' removed from
--   every ARRAY[...] and from the CHECK constraint. The constraint will only
--   re-narrow if no rows still hold the new values, so first:
--     update public.terminal_deals set status = 'loi_signed'
--      where status in ('pending_final_loi', 'psa_signed');

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
      'pending_final_loi',
      'psa_signed',
      'published',
      'under_review',
      'assigned',
      'closed',
      'cancelled'
    ));

-- ── 2. terminal_deals — the dashboard gate ─────────────────────────────────
DROP POLICY IF EXISTS "Investors can view visible deals" ON public.terminal_deals;
CREATE POLICY "Investors can view visible deals" ON public.terminal_deals
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND status IN (
      'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
      'published', 'assigned', 'closed', 'cancelled'
    )
  );

-- ── 3. Per-deal asset tables (include 'cancelled') ─────────────────────────
DROP POLICY IF EXISTS "Investors can view photos" ON public.terminal_deal_photos;
CREATE POLICY "Investors can view photos" ON public.terminal_deal_photos
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed', 'cancelled'
      )
    )
  );

DROP POLICY IF EXISTS "Investors can view folders" ON public.terminal_dd_folders;
CREATE POLICY "Investors can view folders" ON public.terminal_dd_folders
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed', 'cancelled'
      )
    )
  );

DROP POLICY IF EXISTS "Investors can view documents" ON public.terminal_dd_documents;
CREATE POLICY "Investors can view documents" ON public.terminal_dd_documents
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed', 'cancelled'
      )
    )
  );

-- NOTE: this policy has no terminal_user_role() check — preserved as-is.
DROP POLICY IF EXISTS "Investors view addresses of visible deals" ON public.terminal_deal_addresses;
CREATE POLICY "Investors view addresses of visible deals" ON public.terminal_deal_addresses
  FOR SELECT USING (
    deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed', 'cancelled'
      )
    )
  );

DROP POLICY IF EXISTS "tenant_leases_investor_read" ON public.tenant_leases;
CREATE POLICY "tenant_leases_investor_read" ON public.tenant_leases
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed', 'cancelled'
      )
    )
  );

DROP POLICY IF EXISTS "capex_items_investor_read" ON public.capex_items;
CREATE POLICY "capex_items_investor_read" ON public.capex_items
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed', 'cancelled'
      )
    )
  );

DROP POLICY IF EXISTS "exit_scenarios_investor_read" ON public.exit_scenarios;
CREATE POLICY "exit_scenarios_investor_read" ON public.exit_scenarios
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed', 'cancelled'
      )
    )
  );

-- ── 4. Tables that omit 'cancelled' (preserved) ────────────────────────────
DROP POLICY IF EXISTS "deal_insights_investor_read" ON public.terminal_deal_insights;
CREATE POLICY "deal_insights_investor_read" ON public.terminal_deal_insights
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed'
      )
    )
  );

DROP POLICY IF EXISTS "ai_conversations_investor_own" ON public.terminal_ai_conversations;
CREATE POLICY "ai_conversations_investor_own" ON public.terminal_ai_conversations
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND user_id = auth.uid()
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed'
      )
    )
  );

DROP POLICY IF EXISTS "ai_conversations_investor_delete" ON public.terminal_ai_conversations;
CREATE POLICY "ai_conversations_investor_delete" ON public.terminal_ai_conversations
  FOR DELETE USING (
    terminal_user_role() = 'investor'
    AND user_id = auth.uid()
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed'
      )
    )
  );

-- INSERT policy — gated by WITH CHECK, not USING. Without this an investor
-- could not start an AI conversation on a deal in one of the new statuses.
DROP POLICY IF EXISTS "ai_conversations_investor_insert" ON public.terminal_ai_conversations;
CREATE POLICY "ai_conversations_investor_insert" ON public.terminal_ai_conversations
  FOR INSERT WITH CHECK (
    terminal_user_role() = 'investor'
    AND user_id = auth.uid()
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'loi_signed', 'pending_final_loi', 'psa_signed',
        'published', 'assigned', 'closed'
      )
    )
  );

-- ── 5. Activity log (omits 'cancelled', includes 'marketplace') ────────────
DROP POLICY IF EXISTS "Investors can view admin activity" ON public.terminal_activity_log;
CREATE POLICY "Investors can view admin activity" ON public.terminal_activity_log
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND action IN (
      'deal_created', 'deal_published', 'deal_updated', 'deal_document_uploaded'
    )
    AND deal_id IN (
      SELECT id FROM public.terminal_deals
      WHERE status IN (
        'coming_soon', 'marketplace', 'loi_signed', 'pending_final_loi',
        'psa_signed', 'published', 'assigned', 'closed'
      )
    )
  );

COMMIT;
