-- ============================================================================
-- AI usage tracking — replaces terminal_ai_audit
-- ============================================================================
-- New per-turn append log of real Anthropic token usage. Replaces the
-- terminal_ai_audit table, which conflated per-message metrics with arbitrary
-- event payloads and stored char/4 estimates rather than real usage.
--
-- terminal_ai_audit is renamed to _deprecated_terminal_ai_audit (NOT dropped)
-- so its rows remain available for ~7 days. A follow-up migration will hard-
-- drop the deprecated table after the cooldown.
--
-- ROLLBACK (within 7 days):
--   drop table if exists terminal_ai_usage;
--   alter table _deprecated_terminal_ai_audit rename to terminal_ai_audit;
--   -- then re-create the policies from 20260507_ai_assistant_rls.sql.

-- ── New table ────────────────────────────────────────────────────────────────
create table terminal_ai_usage (
  id              bigserial   primary key,
  user_id         uuid        not null references terminal_users(id) on delete cascade,
  deal_id         uuid        references terminal_deals(id) on delete set null,
  conversation_id uuid        references terminal_ai_conversations(id) on delete set null,
  model           text        not null,
  input_tokens    integer     not null default 0 check (input_tokens >= 0),
  output_tokens   integer     not null default 0 check (output_tokens >= 0),
  created_at      timestamptz not null default now()
);

create index on terminal_ai_usage (user_id, created_at desc);
create index on terminal_ai_usage (deal_id, created_at desc);
create index on terminal_ai_usage (created_at desc);

-- ── Backfill from terminal_ai_audit (best-effort) ────────────────────────────
-- Old rows had token counts inside the `payload` jsonb when event_type was
-- a chat turn. Map whatever lines up; rows where the payload doesn't carry
-- usable counts are skipped (they were heartbeat/admin-access events).
insert into terminal_ai_usage (user_id, deal_id, conversation_id, model, input_tokens, output_tokens, created_at)
select
  user_id,
  deal_id,
  conversation_id,
  coalesce(payload->>'model', 'unknown')                                          as model,
  greatest(coalesce((payload->>'input_tokens')::int, 0), 0)                       as input_tokens,
  greatest(coalesce((payload->>'output_tokens')::int, 0), 0)                      as output_tokens,
  created_at
from terminal_ai_audit
where (payload ? 'input_tokens') or (payload ? 'output_tokens');

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table terminal_ai_usage enable row level security;

-- Owners and employees can read all usage.
create policy "ai_usage_owner_employee_select"
  on terminal_ai_usage
  for select
  using (
    exists (
      select 1 from terminal_users u
      where u.id = auth.uid() and u.role in ('owner', 'employee')
    )
  );

-- Investors can read only their own usage.
create policy "ai_usage_self_select"
  on terminal_ai_usage
  for select
  using (user_id = auth.uid());

-- No client INSERT policy: writes happen exclusively via service role from n8n.

-- ── Deprecate the old audit table ────────────────────────────────────────────
drop policy if exists "ai_audit_owner_employee_select" on terminal_ai_audit;
drop policy if exists "ai_audit_insert"                on terminal_ai_audit;

alter table terminal_ai_audit rename to _deprecated_terminal_ai_audit;
