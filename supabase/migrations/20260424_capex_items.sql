-- ============================================================================
-- CapEx / Property Condition feature
-- Standalone; does NOT feed into deal calculations or engine fields.
-- Portfolio-aware: capex_items.address_id is NULL for single-property deals,
-- or references terminal_deal_addresses for portfolios.
-- ============================================================================

CREATE TABLE IF NOT EXISTS capex_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  address_id UUID REFERENCES terminal_deal_addresses(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  current_condition TEXT DEFAULT 'Unknown',
  year_last_replaced TEXT,
  useful_life_remaining TEXT,
  estimated_replacement_cost NUMERIC,
  priority TEXT DEFAULT 'During Hold',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  ai_extracted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capex_items_deal_id ON capex_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_capex_items_address_id ON capex_items(address_id);
CREATE INDEX IF NOT EXISTS idx_capex_items_sort ON capex_items(deal_id, sort_order);

-- Free-form narrative (source text that was parsed into structured items)
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS capex_narrative TEXT DEFAULT NULL;
ALTER TABLE terminal_deal_addresses ADD COLUMN IF NOT EXISTS capex_narrative TEXT DEFAULT NULL;

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Uses the terminal_user_role() SECURITY DEFINER helper (see 002_terminal_rls.sql)
-- to match project convention.
ALTER TABLE capex_items ENABLE ROW LEVEL SECURITY;

-- Owners/employees can do everything
DROP POLICY IF EXISTS "capex_items_admin_all" ON capex_items;
CREATE POLICY "capex_items_admin_all"
  ON capex_items
  FOR ALL
  USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

-- Investors can read capex for any deal they can see (same status gating used
-- by terminal_deal_photos / terminal_dd_folders / tenant_leases).
DROP POLICY IF EXISTS "capex_items_investor_read" ON capex_items;
CREATE POLICY "capex_items_investor_read"
  ON capex_items
  FOR SELECT
  USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM terminal_deals
      WHERE status IN ('coming_soon', 'loi_signed', 'published', 'assigned', 'closed')
    )
  );

-- ── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_capex_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS capex_items_updated_at ON capex_items;
CREATE TRIGGER capex_items_updated_at
  BEFORE UPDATE ON capex_items
  FOR EACH ROW
  EXECUTE FUNCTION set_capex_items_updated_at();
