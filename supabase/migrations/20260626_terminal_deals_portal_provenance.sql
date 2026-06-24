-- 20260626_terminal_deals_portal_provenance.sql
-- Adds provenance columns to terminal_deals so deals promoted from the
-- Reprime Portal (listings/properties) can be traced back to source and
-- de-duplicated.
--
-- Three columns:
--   source                   — 'manual' | 'portal_match' | 'bulk_import'
--   source_portal_listing_id — portal listings.id UUID; unique when set
--   source_mandate_id        — the terminal_crm_mandate that surfaced the
--                              match (nullable: ad-hoc criteria leave it NULL)
--
-- The partial UNIQUE index guarantees a given portal listing becomes a
-- terminal_deal exactly once. NULL (manual deals) is excluded.
--
-- Depends on: 001_terminal_tables.sql (terminal_deals),
--             20260624_crm_criteria_form.sql (terminal_crm_mandates).

-- ROLLBACK:
--   begin;
--   drop index if exists public.idx_terminal_deals_source_mandate;
--   drop index if exists public.idx_terminal_deals_source;
--   drop index if exists public.idx_terminal_deals_source_portal_listing;
--   alter table public.terminal_deals
--     drop column if exists source_mandate_id,
--     drop column if exists source_portal_listing_id,
--     drop column if exists source;
--   commit;

BEGIN;

ALTER TABLE public.terminal_deals
  ADD COLUMN source                   text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','portal_match','bulk_import')),
  ADD COLUMN source_portal_listing_id uuid,
  ADD COLUMN source_mandate_id        uuid REFERENCES public.terminal_crm_mandates(id) ON DELETE SET NULL;

-- Dedup: a portal listing can become a terminal_deal at most once.
CREATE UNIQUE INDEX idx_terminal_deals_source_portal_listing
  ON public.terminal_deals (source_portal_listing_id)
  WHERE source_portal_listing_id IS NOT NULL;

-- For "show me portal-sourced deals" filters in admin.
CREATE INDEX idx_terminal_deals_source
  ON public.terminal_deals (source)
  WHERE source <> 'manual';

-- For "which deals came out of this investor's mandate" queries.
CREATE INDEX idx_terminal_deals_source_mandate
  ON public.terminal_deals (source_mandate_id)
  WHERE source_mandate_id IS NOT NULL;

COMMIT;
