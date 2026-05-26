-- ============================================================================
-- Investor CRM — relationship system of record (staff-only).
-- Distinct from terminal_users (auth accounts). These are CRM contacts:
-- leads -> qualified -> committed -> funded -> repeat, with a full activity
-- timeline (terminal_crm_messages) attached to each.
-- ============================================================================
-- ROLLBACK:
--   drop trigger if exists terminal_crm_messages_updated_at on terminal_crm_messages;
--   drop function if exists set_terminal_crm_messages_updated_at();
--   drop table if exists terminal_crm_messages;
--   drop trigger if exists terminal_crm_investors_updated_at on terminal_crm_investors;
--   drop function if exists set_terminal_crm_investors_updated_at();
--   drop table if exists terminal_crm_investors;

CREATE TABLE IF NOT EXISTS terminal_crm_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT,
  title TEXT,
  photo_url TEXT,

  -- Contact
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  linkedin_url TEXT,
  preferred_contact_method TEXT
    CHECK (preferred_contact_method IN ('email', 'phone', 'whatsapp', 'text_message', 'linkedin', 'zoom')),

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',

  -- Classification
  status TEXT NOT NULL DEFAULT 'lead'
    CHECK (status IN ('lead', 'qualified', 'committed', 'funded', 'repeat')),
  source TEXT,
  referred_by TEXT,
  entity_type TEXT,
  is_accredited BOOLEAN DEFAULT FALSE,

  -- Capital
  equity_ready NUMERIC(15,2),
  equity_committed NUMERIC(15,2),
  equity_timeline TEXT,
  total_deployed_with_reprime NUMERIC(15,2) DEFAULT 0,
  deal_count INTEGER DEFAULT 0,

  -- Investment preferences (JSONB) — see CrmInvestmentPreferences in database.ts
  investment_preferences JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Documents (JSONB array) — [{ name, url, size, type, uploaded_at }]
  documents JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Engagement
  last_contacted_at TIMESTAMPTZ,
  last_contacted_by TEXT,
  internal_notes TEXT,

  -- Lifecycle
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES terminal_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_investors_status ON terminal_crm_investors (status);
CREATE INDEX IF NOT EXISTS idx_crm_investors_archived ON terminal_crm_investors (is_archived);
CREATE INDEX IF NOT EXISTS idx_crm_investors_last_contacted ON terminal_crm_investors (last_contacted_at DESC);

CREATE OR REPLACE FUNCTION set_terminal_crm_investors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS terminal_crm_investors_updated_at ON terminal_crm_investors;
CREATE TRIGGER terminal_crm_investors_updated_at
  BEFORE UPDATE ON terminal_crm_investors
  FOR EACH ROW
  EXECUTE FUNCTION set_terminal_crm_investors_updated_at();

-- ── Activity timeline ────────────────────────────────────────────────────────
-- The heart of the CRM: every interaction is a timestamped message.
CREATE TABLE IF NOT EXISTS terminal_crm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  investor_id UUID NOT NULL REFERENCES terminal_crm_investors(id) ON DELETE CASCADE,

  -- Optional deal context (free text for now; deals table later)
  deal_reference TEXT,

  -- Content
  body TEXT,
  type TEXT NOT NULL DEFAULT 'note'
    CHECK (type IN (
      'note', 'email', 'whatsapp', 'phone_call', 'text_message',
      'zoom', 'meeting', 'document_sent', 'commitment', 'follow_up'
    )),
  direction TEXT DEFAULT 'outbound'
    CHECK (direction IN ('outbound', 'inbound', 'internal')),
  posted_by TEXT NOT NULL,

  -- Attachments (JSONB array) — [{ name, url, size, type }]
  attachments JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- Financial context
  amount_discussed NUMERIC(15,2),
  commitment_amount NUMERIC(15,2),

  -- Follow-up
  follow_up_date DATE,
  follow_up_assigned_to TEXT,
  follow_up_completed BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up_completed_at TIMESTAMPTZ,

  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_messages_investor ON terminal_crm_messages (investor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_messages_pinned ON terminal_crm_messages (investor_id) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_crm_messages_followup ON terminal_crm_messages (follow_up_date)
  WHERE follow_up_date IS NOT NULL AND follow_up_completed = FALSE;

CREATE OR REPLACE FUNCTION set_terminal_crm_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS terminal_crm_messages_updated_at ON terminal_crm_messages;
CREATE TRIGGER terminal_crm_messages_updated_at
  BEFORE UPDATE ON terminal_crm_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_terminal_crm_messages_updated_at();
