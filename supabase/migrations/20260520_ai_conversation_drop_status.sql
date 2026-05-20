-- ============================================================================
-- Conversation delete: switch from soft-archive to hard delete.
-- Drops the terminal_ai_conversations.status column (no more 'active'/'archived')
-- and adds an investor DELETE policy so users can remove their own conversations.
-- Depends on: 20260507_ai_assistant_tables.sql, 20260507_ai_assistant_rls.sql
-- ============================================================================
-- ROLLBACK:
--   drop policy if exists "ai_conversations_investor_delete" on terminal_ai_conversations;
--   alter table terminal_ai_conversations
--     add column status text not null default 'active'
--     check (status in ('active', 'archived'));

-- The status column backed the old soft-delete model. Deletes are now hard
-- (the row is removed and its n8n_chat_histories messages are purged by the
-- deleteConversation server action), so the column is no longer needed.
-- NOTE: the n8n Deal Assistant workflow (6hz22YdBC500tHxg) "Create Conversation"
-- node no longer writes status as of 2026-05-20 — safe to drop.
alter table terminal_ai_conversations
  drop column if exists status;

-- Owners/employees already have ALL via ai_conversations_owner_employee_all.
-- Investors could read + insert their own conversations but not delete them;
-- grant DELETE scoped to their own rows (mirrors ai_conversations_investor_own).
create policy "ai_conversations_investor_delete"
  on terminal_ai_conversations
  for delete
  using (
    terminal_user_role() = 'investor'
    and user_id = auth.uid()
    and deal_id in (
      select id from terminal_deals
      where status in ('coming_soon', 'loi_signed', 'published', 'assigned', 'closed')
    )
  );
