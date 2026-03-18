-- Create storage buckets for deal assets
-- Note: Bucket creation via SQL may require running in the Supabase Dashboard SQL Editor
-- or using the Supabase CLI. These are provided as reference.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('terminal-deal-photos', 'terminal-deal-photos', true),
  ('terminal-dd-documents', 'terminal-dd-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for terminal-deal-photos (public read, authenticated write)
CREATE POLICY "Public can view deal photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'terminal-deal-photos');

CREATE POLICY "Authenticated users can upload deal photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'terminal-deal-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update deal photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'terminal-deal-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete deal photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'terminal-deal-photos' AND auth.role() = 'authenticated');

-- Storage policies for terminal-dd-documents (authenticated only)
CREATE POLICY "Authenticated can view DD documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'terminal-dd-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can upload DD documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'terminal-dd-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update DD documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'terminal-dd-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated can delete DD documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'terminal-dd-documents' AND auth.role() = 'authenticated');
