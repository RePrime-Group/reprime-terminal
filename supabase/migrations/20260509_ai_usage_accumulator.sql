-- ============================================================================
-- AI usage: switch from per-turn append log to per-user accumulator
-- ============================================================================
-- Product decision: one row per user, with input/output token counts
-- accumulated on every chat turn instead of appending a new row per turn.
--
-- The previous append log is renamed to _legacy_terminal_ai_usage_log so
-- existing rows are preserved (~7-day cooldown). A follow-up migration will
-- hard-drop it.
--
-- ROLLBACK (within 7 days):
--   drop function if exists terminal_ai_usage_increment(uuid, bigint, bigint, text, uuid);
--   drop table if exists terminal_ai_usage;
--   alter table _legacy_terminal_ai_usage_log rename to terminal_ai_usage;
--   -- then re-create the policies from 20260508_ai_usage_tracking.sql.

-- 1. Stash the existing append log out of the way.
drop policy if exists "ai_usage_owner_employee_select" on terminal_ai_usage;
drop policy if exists "ai_usage_self_select"           on terminal_ai_usage;
alter table terminal_ai_usage rename to _legacy_terminal_ai_usage_log;

-- 2. New accumulator table.
create table terminal_ai_usage (
  user_id        uuid        primary key references terminal_users(id) on delete cascade,
  input_tokens   bigint      not null default 0 check (input_tokens  >= 0),
  output_tokens  bigint      not null default 0 check (output_tokens >= 0),
  message_count  integer     not null default 0 check (message_count >= 0),
  last_model     text,
  last_deal_id   uuid        references terminal_deals(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 3. Seed from the legacy log so we keep historical totals.
insert into terminal_ai_usage (
  user_id, input_tokens, output_tokens, message_count, last_model, last_deal_id, created_at, updated_at
)
select
  user_id,
  coalesce(sum(input_tokens),  0)                                                          as input_tokens,
  coalesce(sum(output_tokens), 0)                                                          as output_tokens,
  count(*)                                                                                  as message_count,
  (array_agg(model   order by created_at desc) filter (where model   is not null))[1]      as last_model,
  (array_agg(deal_id order by created_at desc) filter (where deal_id is not null))[1]      as last_deal_id,
  min(created_at)                                                                           as created_at,
  max(created_at)                                                                           as updated_at
from _legacy_terminal_ai_usage_log
group by user_id;

-- 4. RLS: owners/employees see all, investors see their own, no client writes.
alter table terminal_ai_usage enable row level security;

create policy "ai_usage_owner_employee_select"
  on terminal_ai_usage
  for select
  using (
    exists (
      select 1 from terminal_users u
      where u.id = auth.uid() and u.role in ('owner', 'employee')
    )
  );

create policy "ai_usage_self_select"
  on terminal_ai_usage
  for select
  using (user_id = auth.uid());

-- 5. Atomic increment function called from n8n via PostgREST RPC.
-- Adds the per-turn tokens to the user's row, creating it if it doesn't exist.
create or replace function terminal_ai_usage_increment(
  p_user_id        uuid,
  p_input_tokens   bigint,
  p_output_tokens  bigint,
  p_model          text default null,
  p_deal_id        uuid default null
) returns void
language sql
security definer
as $$
  insert into terminal_ai_usage (
    user_id, input_tokens, output_tokens, message_count, last_model, last_deal_id, updated_at
  )
  values (
    p_user_id, p_input_tokens, p_output_tokens, 1, p_model, p_deal_id, now()
  )
  on conflict (user_id) do update set
    input_tokens  = terminal_ai_usage.input_tokens  + excluded.input_tokens,
    output_tokens = terminal_ai_usage.output_tokens + excluded.output_tokens,
    message_count = terminal_ai_usage.message_count + 1,
    last_model    = coalesce(excluded.last_model,   terminal_ai_usage.last_model),
    last_deal_id  = coalesce(excluded.last_deal_id, terminal_ai_usage.last_deal_id),
    updated_at    = now();
$$;

grant execute on function terminal_ai_usage_increment(uuid, bigint, bigint, text, uuid) to service_role, authenticated;
