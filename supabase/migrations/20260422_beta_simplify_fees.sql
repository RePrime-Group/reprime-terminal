-- Beta Simplification: Zero all fees, add CapEx / closing cost / disposition fields.
-- Keep the existing columns (do not alter defaults of pre-existing fee columns —
-- engine defaults are the source of truth, and the UPDATE below zeroes live data).

-- New configurable closing / disposition / reserve fields
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS legal_title_estimate text DEFAULT NULL;
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS disposition_cost_pct text DEFAULT NULL;
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS capex text DEFAULT NULL;

-- Zero all fee fields on every existing deal so beta investors see clean economics.
-- This does NOT touch deal terms (purchase_price, noi, seller_credit, ltv,
-- interest_rate, amortization_years, mezz_percent, mezz_rate, mezz_term_months,
-- seller_financing, hold_period_years, exit_cap_rate, rent_growth).
UPDATE terminal_deals SET
  loan_fee_points = '0',
  acq_fee = '0',
  assignment_fee = '0',
  asset_mgmt_fee = '0',
  gp_carry = '0',
  pref_return = '0'
WHERE loan_fee_points IS NOT NULL
   OR acq_fee IS NOT NULL
   OR assignment_fee IS NOT NULL
   OR asset_mgmt_fee IS NOT NULL
   OR gp_carry IS NOT NULL
   OR pref_return IS NOT NULL;
