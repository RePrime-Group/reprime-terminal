ALTER TABLE public.terminal_deals
  ADD COLUMN IF NOT EXISTS tenants_report_storage_path text;
