-- Portfolio support: multiple addresses per deal
-- Each address can have its own DD folders, photos, and OMs

CREATE TABLE IF NOT EXISTS terminal_deal_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  label text NOT NULL,  -- e.g. "Building A" or "123 Main St"
  address text,
  city text,
  state text,
  square_footage text,
  units text,
  year_built integer,
  om_storage_path text,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_addresses_deal ON terminal_deal_addresses(deal_id);

-- Add address_id to DD folders so folders can be per-address
ALTER TABLE terminal_dd_folders
  ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES terminal_deal_addresses(id) ON DELETE CASCADE;

-- Add address_id to deal photos so photos can be per-address
ALTER TABLE terminal_deal_photos
  ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES terminal_deal_addresses(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE terminal_deal_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage addresses" ON terminal_deal_addresses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM terminal_users WHERE id = auth.uid() AND role IN ('owner', 'employee'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM terminal_users WHERE id = auth.uid() AND role IN ('owner', 'employee'))
  );

CREATE POLICY "Investors view addresses of visible deals" ON terminal_deal_addresses
  FOR SELECT USING (
    deal_id IN (
      SELECT id FROM terminal_deals
      WHERE status IN ('coming_soon', 'loi_signed', 'published', 'assigned', 'closed')
    )
  );
