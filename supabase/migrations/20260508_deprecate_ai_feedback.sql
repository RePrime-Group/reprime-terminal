-- Deprecate the AI feedback feature.
--
-- The thumbs-up/down UI, /api/ai/feedback route, and deal-assistant-feedback
-- n8n workflow have been removed. We rename rather than DROP so the data is
-- recoverable for ~7 days; a follow-up migration will hard-drop the table.
--
-- Rollback (within 7 days):
--   alter table _deprecated_terminal_ai_feedback rename to terminal_ai_feedback;
--   -- then re-create the two policies below.

-- Drop RLS policies first (they reference the table by name).
drop policy if exists "ai_feedback_owner_employee_all" on terminal_ai_feedback;
drop policy if exists "ai_feedback_investor_insert"    on terminal_ai_feedback;

-- Rename the table out of the active namespace.
alter table terminal_ai_feedback rename to _deprecated_terminal_ai_feedback;
