-- ============================================================================
-- RLS policies for AI assistant tables + read-only reprime_ai_read role
-- Depends on: terminal_user_role() SECURITY DEFINER from 002_terminal_rls.sql
-- ============================================================================
-- ROLLBACK:
--   drop policy if exists "ai_conversations_owner_employee_all"  on terminal_ai_conversations;
--   drop policy if exists "ai_conversations_investor_own"        on terminal_ai_conversations;
--   drop policy if exists "ai_conversations_investor_insert"     on terminal_ai_conversations;
--   drop policy if exists "ai_messages_owner_employee_all"       on terminal_ai_messages;
--   drop policy if exists "ai_messages_investor_own"             on terminal_ai_messages;
--   drop policy if exists "ai_messages_investor_insert"          on terminal_ai_messages;
--   drop policy if exists "ai_feedback_owner_employee_all"       on terminal_ai_feedback;
--   drop policy if exists "ai_feedback_investor_insert"          on terminal_ai_feedback;
--   drop policy if exists "ai_audit_owner_employee_select"       on terminal_ai_audit;
--   drop policy if exists "ai_audit_insert"                      on terminal_ai_audit;
--   alter table terminal_ai_conversations disable row level security;
--   alter table terminal_ai_messages      disable row level security;
--   alter table terminal_ai_feedback      disable row level security;
--   alter table terminal_ai_audit         disable row level security;
--   drop role if exists reprime_ai_read;

-- ── terminal_ai_conversations ────────────────────────────────────────────────

alter table terminal_ai_conversations enable row level security;

-- Owners/employees can manage all conversations.
create policy "ai_conversations_owner_employee_all"
  on terminal_ai_conversations
  for all
  using (terminal_user_role() in ('owner', 'employee'))
  with check (terminal_user_role() in ('owner', 'employee'));

-- Investors can read their own conversations, but only for deals they are entitled to.
create policy "ai_conversations_investor_own"
  on terminal_ai_conversations
  for select
  using (
    terminal_user_role() = 'investor'
    and user_id = auth.uid()
    and deal_id in (
      select id from terminal_deals
      where status in ('coming_soon', 'loi_signed', 'published', 'assigned', 'closed')
    )
  );

-- Investors can insert conversations for themselves on entitled deals.
create policy "ai_conversations_investor_insert"
  on terminal_ai_conversations
  for insert
  with check (
    terminal_user_role() = 'investor'
    and user_id = auth.uid()
    and deal_id in (
      select id from terminal_deals
      where status in ('coming_soon', 'loi_signed', 'published', 'assigned', 'closed')
    )
  );

-- ── terminal_ai_messages ─────────────────────────────────────────────────────

alter table terminal_ai_messages enable row level security;

-- Owners/employees can manage all messages.
create policy "ai_messages_owner_employee_all"
  on terminal_ai_messages
  for all
  using (terminal_user_role() in ('owner', 'employee'))
  with check (terminal_user_role() in ('owner', 'employee'));

-- Investors can read messages that belong to their own conversations.
create policy "ai_messages_investor_own"
  on terminal_ai_messages
  for select
  using (
    terminal_user_role() = 'investor'
    and exists (
      select 1 from terminal_ai_conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

-- Investors can insert messages into their own conversations.
create policy "ai_messages_investor_insert"
  on terminal_ai_messages
  for insert
  with check (
    terminal_user_role() = 'investor'
    and exists (
      select 1 from terminal_ai_conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ── terminal_ai_feedback ─────────────────────────────────────────────────────

alter table terminal_ai_feedback enable row level security;

-- Owners/employees can read and manage all feedback.
create policy "ai_feedback_owner_employee_all"
  on terminal_ai_feedback
  for all
  using (terminal_user_role() in ('owner', 'employee'))
  with check (terminal_user_role() in ('owner', 'employee'));

-- Investors can insert feedback for messages they can read (own conversations).
create policy "ai_feedback_investor_insert"
  on terminal_ai_feedback
  for insert
  with check (
    terminal_user_role() = 'investor'
    and user_id = auth.uid()
    and exists (
      select 1 from terminal_ai_messages m
      join terminal_ai_conversations c on c.id = m.conversation_id
      where m.id = message_id
        and c.user_id = auth.uid()
    )
  );

-- ── terminal_ai_audit ────────────────────────────────────────────────────────

alter table terminal_ai_audit enable row level security;

-- Only owners and employees can read the audit log.
create policy "ai_audit_owner_employee_select"
  on terminal_ai_audit
  for select
  using (terminal_user_role() in ('owner', 'employee'));

-- Any authenticated user can insert audit rows (n8n runs under their JWT).
create policy "ai_audit_insert"
  on terminal_ai_audit
  for insert
  with check (user_id = auth.uid());

-- ── Read-only Postgres role for n8n Supabase MCP ────────────────────────────
-- This role is used by the n8n Supabase MCP client (JWT-scoped, per-request).
-- RLS still applies; this role only grants the SELECT privilege at the schema
-- level so the agent cannot accidentally issue writes.

create role reprime_ai_read nologin;

grant select on terminal_deals             to reprime_ai_read;
grant select on tenant_leases              to reprime_ai_read;
grant select on terminal_dd_documents      to reprime_ai_read;
-- terminal_doc_chunks GRANT added in Phase 5 (pgvector migration)

-- Revoke any future auto-granted privileges from this role so new tables are
-- not silently exposed.
alter default privileges in schema public revoke all on tables from reprime_ai_read;
