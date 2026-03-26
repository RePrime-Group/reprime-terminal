-- Financial Engine — Add all missing fields for full calculation support

-- Senior Debt Parameters
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS ltv text DEFAULT '75';
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS interest_rate text DEFAULT '6.00';
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS amortization_years text DEFAULT '30';
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS loan_fee_points text DEFAULT '1';
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS io_period_months text DEFAULT '0';

-- Mezzanine Parameters
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS mezz_percent text DEFAULT '15';
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS mezz_rate text DEFAULT '5.00';
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS mezz_term_months text DEFAULT '60';

-- Additional Credits
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS seller_credit text DEFAULT '0';

-- Fee Structure (update defaults)
-- assignment_fee, acq_fee, asset_mgmt_fee, gp_carry, loan_fee already exist

-- Preferred Return
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS pref_return text DEFAULT '8';

-- Hold/Exit Assumptions
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS hold_period_years text DEFAULT '5';
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS exit_cap_rate text;

-- Flag for whether senior debt terms are estimated vs quoted
ALTER TABLE terminal_deals ADD COLUMN IF NOT EXISTS debt_terms_quoted boolean DEFAULT false;
