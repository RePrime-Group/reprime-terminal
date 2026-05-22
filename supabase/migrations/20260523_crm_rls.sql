-- ============================================================================
-- RLS for the Investor CRM + atomic message-save RPC.
-- Depends on: terminal_user_role() SECURITY DEFINER from 002_terminal_rls.sql.
-- CRM is staff-only — owners + employees, never investors.
-- ============================================================================
-- ROLLBACK:
--   drop function if exists crm_add_message(uuid, text, text, text, text, text, numeric, numeric, jsonb, date, text);
--   drop policy if exists "crm_investors_staff_all" on terminal_crm_investors;
--   drop policy if exists "crm_messages_staff_all"  on terminal_crm_messages;
--   alter table terminal_crm_investors disable row level security;
--   alter table terminal_crm_messages  disable row level security;

ALTER TABLE terminal_crm_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_crm_messages  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_investors_staff_all" ON terminal_crm_investors;
CREATE POLICY "crm_investors_staff_all"
  ON terminal_crm_investors
  FOR ALL
  USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

DROP POLICY IF EXISTS "crm_messages_staff_all" ON terminal_crm_messages;
CREATE POLICY "crm_messages_staff_all"
  ON terminal_crm_messages
  FOR ALL
  USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

-- ── crm_add_message ──────────────────────────────────────────────────────────
-- Inserts a message and applies its side-effects atomically:
--   1. insert the message
--   2. bump the investor's last_contacted_at / last_contacted_by
--   3. if it's a commitment, increment total_deployed_with_reprime + deal_count
-- This is the ONLY place total_deployed_with_reprime is incremented (see plan §8:
-- avoids double-counting). Returns the new message id.
CREATE OR REPLACE FUNCTION crm_add_message(
  p_investor_id           UUID,
  p_type                  TEXT,
  p_direction             TEXT,
  p_body                  TEXT,
  p_posted_by             TEXT,
  p_deal_reference        TEXT,
  p_amount_discussed      NUMERIC,
  p_commitment_amount     NUMERIC,
  p_attachments           JSONB,
  p_follow_up_date        DATE,
  p_follow_up_assigned_to TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF terminal_user_role() NOT IN ('owner', 'employee') THEN
    RAISE EXCEPTION 'crm_add_message: forbidden';
  END IF;

  INSERT INTO terminal_crm_messages (
    investor_id, type, direction, body, posted_by, deal_reference,
    amount_discussed, commitment_amount, attachments,
    follow_up_date, follow_up_assigned_to
  )
  VALUES (
    p_investor_id, p_type, COALESCE(p_direction, 'outbound'), p_body, p_posted_by, p_deal_reference,
    p_amount_discussed, p_commitment_amount, COALESCE(p_attachments, '[]'::JSONB),
    p_follow_up_date, p_follow_up_assigned_to
  )
  RETURNING id INTO v_id;

  UPDATE terminal_crm_investors
     SET last_contacted_at = NOW(),
         last_contacted_by = p_posted_by
   WHERE id = p_investor_id;

  IF p_type = 'commitment' AND p_commitment_amount IS NOT NULL THEN
    UPDATE terminal_crm_investors
       SET total_deployed_with_reprime = COALESCE(total_deployed_with_reprime, 0) + p_commitment_amount,
           deal_count = COALESCE(deal_count, 0) + 1
     WHERE id = p_investor_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION crm_add_message(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, DATE, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION crm_add_message(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, DATE, TEXT) TO authenticated, service_role;
