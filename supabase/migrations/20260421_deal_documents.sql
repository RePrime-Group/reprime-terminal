-- Additional deal-level documents that admins upload and investors view
-- (signed LOI, PSA, full research report, CoStar report).
-- Offering Memorandum already exists as om_storage_path.

ALTER TABLE public.terminal_deals
  ADD COLUMN IF NOT EXISTS loi_signed_storage_path text,
  ADD COLUMN IF NOT EXISTS psa_storage_path text,
  ADD COLUMN IF NOT EXISTS full_report_storage_path text,
  ADD COLUMN IF NOT EXISTS costar_report_storage_path text;
