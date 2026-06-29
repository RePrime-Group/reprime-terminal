-- ============================================================================
-- Deal Insights — admin-authored, category-tagged notes shown on the deal page.
--
-- Categories are GLOBAL (a shared taxonomy, not deal-scoped). `name` is a
-- snake_case slug, globally UNIQUE, and immutable after creation; `display_name`
-- is the human label and is editable anytime. An insight ties a global category
-- to a specific deal.
--
-- RLS mirrors exit_scenarios: admins (owner/employee) manage everything;
-- investors read insights on deals in a visible status. Category labels are
-- non-sensitive, so investors may read the whole category list.
-- ============================================================================

-- ── Categories (global taxonomy) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terminal_insight_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,     -- snake_case slug, set at creation, NEVER updated
  display_name TEXT NOT NULL,    -- human label, editable anytime
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Insights (category × deal) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terminal_deal_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  category_id UUID NOT NULL
    REFERENCES terminal_insight_categories(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_insights_deal ON terminal_deal_insights(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_insights_category ON terminal_deal_insights(category_id);

-- ── RLS: categories ─────────────────────────────────────────────────────────
ALTER TABLE terminal_insight_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insight_categories_admin_all" ON terminal_insight_categories;
CREATE POLICY "insight_categories_admin_all"
  ON terminal_insight_categories FOR ALL
  USING (terminal_user_role() IN ('owner','employee'))
  WITH CHECK (terminal_user_role() IN ('owner','employee'));

DROP POLICY IF EXISTS "insight_categories_investor_read" ON terminal_insight_categories;
CREATE POLICY "insight_categories_investor_read"
  ON terminal_insight_categories FOR SELECT
  USING (terminal_user_role() = 'investor');

-- ── RLS: insights ───────────────────────────────────────────────────────────
ALTER TABLE terminal_deal_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_insights_admin_all" ON terminal_deal_insights;
CREATE POLICY "deal_insights_admin_all"
  ON terminal_deal_insights FOR ALL
  USING (terminal_user_role() IN ('owner','employee'))
  WITH CHECK (terminal_user_role() IN ('owner','employee'));

DROP POLICY IF EXISTS "deal_insights_investor_read" ON terminal_deal_insights;
CREATE POLICY "deal_insights_investor_read"
  ON terminal_deal_insights FOR SELECT
  USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM terminal_deals
      WHERE status IN ('coming_soon','loi_signed','published','assigned','closed')
    )
  );

-- ── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_insight_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS insight_categories_updated_at ON terminal_insight_categories;
CREATE TRIGGER insight_categories_updated_at
  BEFORE UPDATE ON terminal_insight_categories
  FOR EACH ROW EXECUTE FUNCTION set_insight_updated_at();

DROP TRIGGER IF EXISTS deal_insights_updated_at ON terminal_deal_insights;
CREATE TRIGGER deal_insights_updated_at
  BEFORE UPDATE ON terminal_deal_insights
  FOR EACH ROW EXECUTE FUNCTION set_insight_updated_at();
