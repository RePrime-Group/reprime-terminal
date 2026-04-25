ALTER TABLE public.terminal_deals
  ADD COLUMN IF NOT EXISTS lease_summary_storage_path text;
