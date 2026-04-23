-- ============================================================================
-- Tenant / Rent Roll feature
-- Standalone tenant roster; does NOT feed into deal calculations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  tenant_name TEXT NOT NULL,
  suite_unit TEXT,
  leased_sf INTEGER,
  annual_base_rent NUMERIC,
  rent_per_sf NUMERIC,
  lease_type TEXT DEFAULT 'NNN',
  lease_start_date TEXT,
  lease_end_date TEXT,
  rent_commencement_date TEXT,
  option_renewals TEXT,
  escalation_structure TEXT,
  cam_reimbursement NUMERIC,
  tax_reimbursement NUMERIC,
  insurance_reimbursement NUMERIC,
  percentage_rent TEXT,
  security_deposit NUMERIC,
  guarantor TEXT,
  tenant_credit_rating TEXT,
  tenant_industry TEXT,
  is_anchor BOOLEAN DEFAULT FALSE,
  is_vacant BOOLEAN DEFAULT FALSE,
  market_rent_estimate NUMERIC,
  notes TEXT,
  status TEXT DEFAULT 'Active',
  sort_order INTEGER DEFAULT 0,
  ai_extracted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_leases_deal_id ON tenant_leases(deal_id);
CREATE INDEX IF NOT EXISTS idx_tenant_leases_sort ON tenant_leases(deal_id, sort_order);

-- Tab visibility toggles on terminal_deals
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS show_rent_roll BOOLEAN DEFAULT TRUE;
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS show_capex BOOLEAN DEFAULT FALSE;
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS show_exit_strategy BOOLEAN DEFAULT FALSE;

-- Cached WALT for portal card display (avoid N+1 queries)
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS computed_walt NUMERIC DEFAULT NULL;

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Matches the project convention: use the SECURITY DEFINER helper
-- terminal_user_role() (defined in 002_terminal_rls.sql) so the policy does
-- not itself depend on the caller's RLS access to terminal_users.
ALTER TABLE tenant_leases ENABLE ROW LEVEL SECURITY;

-- Owners/employees can do everything
DROP POLICY IF EXISTS "tenant_leases_admin_all" ON tenant_leases;
CREATE POLICY "tenant_leases_admin_all"
  ON tenant_leases
  FOR ALL
  USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

-- Investors can read tenants for any deal they can see (same status gating
-- used by terminal_deal_photos / terminal_dd_folders).
DROP POLICY IF EXISTS "tenant_leases_investor_read" ON tenant_leases;
CREATE POLICY "tenant_leases_investor_read"
  ON tenant_leases
  FOR SELECT
  USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM terminal_deals
      WHERE status IN ('coming_soon', 'loi_signed', 'published', 'assigned', 'closed')
    )
  );

-- ── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_tenant_leases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_leases_updated_at ON tenant_leases;
CREATE TRIGGER tenant_leases_updated_at
  BEFORE UPDATE ON tenant_leases
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_leases_updated_at();
