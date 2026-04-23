-- ============================================================================
-- Exit Strategy scenarios
-- Standalone display-only projections. Does NOT feed into deal calculations
-- or any engine function. One row per (deal, scenario_type).
-- ============================================================================

CREATE TABLE IF NOT EXISTS exit_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  scenario_type TEXT NOT NULL
    CHECK (scenario_type IN ('conservative','moderate','aggressive','refinance')),
  scenario_name TEXT NOT NULL,
  exit_year INTEGER DEFAULT 5,
  exit_cap_rate NUMERIC,
  exit_noi NUMERIC,
  additional_capex NUMERIC DEFAULT 0,
  strategy_narrative TEXT,
  buyer_profile TEXT,
  market_comps TEXT,
  refi_params JSONB,  -- { ltv, rate, amortYears } for refinance scenarios
  is_enabled BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  ai_generated_narrative BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (deal_id, scenario_type)
);

CREATE INDEX IF NOT EXISTS idx_exit_scenarios_deal_id ON exit_scenarios(deal_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Uses the terminal_user_role() SECURITY DEFINER helper (002_terminal_rls.sql)
-- to match project convention.
ALTER TABLE exit_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exit_scenarios_admin_all" ON exit_scenarios;
CREATE POLICY "exit_scenarios_admin_all"
  ON exit_scenarios
  FOR ALL
  USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "exit_scenarios_investor_read" ON exit_scenarios;
CREATE POLICY "exit_scenarios_investor_read"
  ON exit_scenarios
  FOR SELECT
  USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM terminal_deals
      WHERE status IN ('coming_soon', 'loi_signed', 'published', 'assigned', 'closed')
    )
  );

-- ── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_exit_scenarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exit_scenarios_updated_at ON exit_scenarios;
CREATE TRIGGER exit_scenarios_updated_at
  BEFORE UPDATE ON exit_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION set_exit_scenarios_updated_at();
