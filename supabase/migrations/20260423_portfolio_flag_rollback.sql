-- Rollback for 20260423_portfolio_flag.sql.
-- Only run this manually if the forward migration succeeded but the result
-- is wrong (bad backfill, code bug, client complaint, etc.). Do NOT add this
-- to the regular migration stream.

BEGIN;

-- Restore any deleted address rows
INSERT INTO public.terminal_deal_addresses
  SELECT * FROM public._backup_20260423_deal_addresses
  WHERE id NOT IN (SELECT id FROM public.terminal_deal_addresses);

-- Restore UPDATEd deal columns back to pre-migration values
UPDATE public.terminal_deals d
SET address = b.address,
    om_storage_path = b.om_storage_path
FROM public._backup_20260423_deals_pre b
WHERE d.id = b.id;

-- Drop the new columns (removes is_portfolio + address from the schema)
ALTER TABLE public.terminal_deals
  DROP COLUMN IF EXISTS is_portfolio,
  DROP COLUMN IF EXISTS address;

COMMIT;

-- Leave the backup tables in place until you've verified rollback worked.
-- When confident, drop them manually:
--   DROP TABLE public._backup_20260423_deal_addresses;
--   DROP TABLE public._backup_20260423_deals_pre;
