-- ============================================================================
-- Storage buckets for the Investor CRM.
-- Note: Bucket creation via SQL may require running in the Supabase Dashboard
-- SQL Editor or the Supabase CLI (same caveat as 004_terminal_storage.sql).
--   terminal-investor-photos — public (profile photos shown in cards)
--   terminal-investor-files  — private (message attachments + documents)
-- ============================================================================
-- ROLLBACK:
--   drop policy if exists "Public can view investor photos" on storage.objects;
--   drop policy if exists "Authenticated can upload investor photos" on storage.objects;
--   drop policy if exists "Authenticated can update investor photos" on storage.objects;
--   drop policy if exists "Authenticated can delete investor photos" on storage.objects;
--   drop policy if exists "Authenticated can view investor files" on storage.objects;
--   drop policy if exists "Authenticated can upload investor files" on storage.objects;
--   drop policy if exists "Authenticated can update investor files" on storage.objects;
--   drop policy if exists "Authenticated can delete investor files" on storage.objects;
--   delete from storage.buckets where id in ('terminal-investor-photos', 'terminal-investor-files');

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('terminal-investor-photos', 'terminal-investor-photos', true),
  ('terminal-investor-files', 'terminal-investor-files', false)
ON CONFLICT (id) DO NOTHING;

-- terminal-investor-photos (public read, authenticated write)
CREATE POLICY "Public can view investor photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'terminal-investor-photos');

CREATE POLICY "Authenticated can upload investor photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'terminal-investor-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update investor photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'terminal-investor-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete investor photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'terminal-investor-photos' AND auth.role() = 'authenticated');

-- terminal-investor-files (authenticated only)
CREATE POLICY "Authenticated can view investor files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'terminal-investor-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can upload investor files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'terminal-investor-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update investor files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'terminal-investor-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete investor files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'terminal-investor-files' AND auth.role() = 'authenticated');
