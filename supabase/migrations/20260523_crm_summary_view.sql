-- ============================================================================
-- terminal_crm_investor_summary — list-view projection with derived counts.
--
-- security_invoker = true is REQUIRED. By default, Postgres runs views with
-- the owner's privileges (the migration role), which bypasses RLS on the
-- underlying tables — every authenticated user would see every CRM row.
-- security_invoker makes the view evaluate RLS as the querying user, so it
-- inherits the staff-only policy on terminal_crm_investors / _messages.
-- ============================================================================
-- ROLLBACK:
--   drop view if exists terminal_crm_investor_summary;

CREATE OR REPLACE VIEW terminal_crm_investor_summary
WITH (security_invoker = true) AS
SELECT
  i.*,
  (i.first_name || ' ' || i.last_name) AS full_name,
  (SELECT COUNT(*) FROM terminal_crm_messages m
     WHERE m.investor_id = i.id) AS message_count,
  (SELECT MAX(m.created_at) FROM terminal_crm_messages m
     WHERE m.investor_id = i.id) AS last_message_at,
  (SELECT COALESCE(SUM(m.commitment_amount), 0) FROM terminal_crm_messages m
     WHERE m.investor_id = i.id AND m.commitment_amount IS NOT NULL) AS total_commitments,
  (SELECT COUNT(*) FROM terminal_crm_messages m
     WHERE m.investor_id = i.id
       AND m.follow_up_date IS NOT NULL
       AND m.follow_up_completed = FALSE) AS pending_follow_up_count,
  (SELECT COUNT(*) FROM terminal_crm_messages m
     WHERE m.investor_id = i.id AND m.is_pinned = TRUE) AS pinned_count
FROM terminal_crm_investors i
WHERE i.is_archived = FALSE;
