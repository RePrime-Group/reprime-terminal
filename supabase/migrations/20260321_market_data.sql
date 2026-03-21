-- Market data table for manually-updated CRE metrics
CREATE TABLE IF NOT EXISTS terminal_market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  value text NOT NULL,
  change text DEFAULT '—',
  direction text DEFAULT 'flat' CHECK (direction IN ('up', 'down', 'flat')),
  source text,
  as_of_date date,
  display_order integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pre-populate with CRE metrics
INSERT INTO terminal_market_data (key, label, value, change, direction, display_order) VALUES
  ('cre_cap_spread', 'CRE Cap Rate Spread', '285 bps', '-12', 'down', 1),
  ('cmbs_delinquency', 'CMBS Delinquency', '11.8%', '+0.4', 'up', 2),
  ('office_vacancy', 'Office Vacancy', '19.6%', '+0.2', 'up', 3),
  ('multifamily_vacancy', 'Multifamily Vacancy', '5.8%', '-0.1', 'down', 4),
  ('industrial_vacancy', 'Industrial Vacancy', '4.2%', '-0.3', 'down', 5),
  ('retail_vacancy', 'Retail Vacancy', '4.1%', '—', 'flat', 6)
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE terminal_market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read market data"
  ON terminal_market_data
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage market data"
  ON terminal_market_data
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM terminal_users
      WHERE id = auth.uid() AND role IN ('owner', 'employee')
    )
  );
