-- Adds is_portfolio flag + street address column to terminal_deals.
-- Backfills 7 misfiled single-property deals from terminal_deal_addresses
-- and flags 5 real portfolios + 1 known 1-address exception as is_portfolio=true.
-- Audited 2026-04-23: 0 address-scoped folders/photos/DD docs, 0 OM conflicts.

BEGIN;

-- Schema additions
ALTER TABLE public.terminal_deals
  ADD COLUMN IF NOT EXISTS is_portfolio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS address text;

-- Snapshot everything we might touch, BEFORE any UPDATE/DELETE.
-- These backup tables let the paired rollback file restore prior state.
CREATE TABLE IF NOT EXISTS public._backup_20260423_deal_addresses AS
  SELECT * FROM public.terminal_deal_addresses;

CREATE TABLE IF NOT EXISTS public._backup_20260423_deals_pre AS
  SELECT id, address, om_storage_path, is_portfolio FROM public.terminal_deals;

-- 1. Flag real portfolios (2+ addresses)
UPDATE public.terminal_deals d
SET is_portfolio = true
WHERE (SELECT count(*) FROM public.terminal_deal_addresses a WHERE a.deal_id = d.id) >= 2;

-- 2. Flag the known 1-address exception as portfolio
--    (Frayser Village Shopping Center & Three Notch Plaza Portfolio)
UPDATE public.terminal_deals
SET is_portfolio = true
WHERE id = '00173b9d-14af-42e9-ab4d-91f59b16c5cc';

-- 3. Backfill street address + OM for single-property deals that were misfiled.
--    Exception already flagged portfolio above, so filter skips it.
UPDATE public.terminal_deals d
SET address = COALESCE(d.address, a.address),
    om_storage_path = COALESCE(d.om_storage_path, a.om_storage_path)
FROM public.terminal_deal_addresses a
WHERE a.deal_id = d.id
  AND d.is_portfolio = false
  AND (SELECT count(*) FROM public.terminal_deal_addresses a2 WHERE a2.deal_id = d.id) = 1;

-- 4. Delete the now-redundant single-address rows.
--    Explicitly excludes the exception (stays as the sole portfolio address).
DELETE FROM public.terminal_deal_addresses a
WHERE (SELECT count(*) FROM public.terminal_deal_addresses a2 WHERE a2.deal_id = a.deal_id) = 1
  AND a.deal_id <> '00173b9d-14af-42e9-ab4d-91f59b16c5cc';

COMMIT;
