-- ============================================================================
-- Drop redundant token-tracking columns from terminal_ai_messages
-- ============================================================================
-- model, input_tokens, output_tokens are now owned by terminal_ai_usage
-- (per-user accumulator with the increment RPC). Keeping them on
-- terminal_ai_messages duplicated the data and the model column went stale
-- whenever the LLM was swapped without a parallel update to the n8n node.
--
-- latency_ms is kept because it's per-message and not tracked elsewhere.
--
-- ROLLBACK:
--   alter table terminal_ai_messages add column model text;
--   alter table terminal_ai_messages add column input_tokens int;
--   alter table terminal_ai_messages add column output_tokens int;

alter table terminal_ai_messages drop column if exists model;
alter table terminal_ai_messages drop column if exists input_tokens;
alter table terminal_ai_messages drop column if exists output_tokens;
