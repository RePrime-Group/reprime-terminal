-- ============================================================================
-- AI Assistant tables: conversations, messages, feedback, audit
-- ============================================================================
-- ROLLBACK:
--   drop table if exists terminal_ai_audit;
--   drop table if exists terminal_ai_feedback;
--   drop table if exists terminal_ai_messages;
--   drop table if exists terminal_ai_conversations;

-- One thread per (user, deal). A user can reopen prior conversations on the same deal.
create table terminal_ai_conversations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references terminal_users(id) on delete cascade,
  deal_id     uuid        not null references terminal_deals(id) on delete cascade,
  title       text,
  status      text        not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on terminal_ai_conversations(user_id, deal_id);
create index on terminal_ai_conversations(deal_id);

-- Each turn (user, assistant, tool) within a conversation thread.
create table terminal_ai_messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references terminal_ai_conversations(id) on delete cascade,
  role            text        not null check (role in ('user', 'assistant', 'tool', 'system')),
  content         jsonb       not null,   -- text + tool_use + tool_result blocks
  tool_calls      jsonb,                  -- tool invocations with inputs/outputs
  citations       jsonb,                  -- deal fields, tenants, documents cited
  model           text,
  input_tokens    int,
  output_tokens   int,
  latency_ms      int,
  created_at      timestamptz not null default now()
);

create index on terminal_ai_messages(conversation_id, created_at);

-- User feedback (thumbs up/down) for quality monitoring.
create table terminal_ai_feedback (
  id          uuid        primary key default gen_random_uuid(),
  message_id  uuid        not null references terminal_ai_messages(id) on delete cascade,
  user_id     uuid        not null references terminal_users(id),
  rating      smallint    not null check (rating in (-1, 1)),
  reason      text,
  created_at  timestamptz not null default now()
);

create index on terminal_ai_feedback(message_id);
create index on terminal_ai_feedback(user_id);

-- Admin-only audit log: every webhook request and admin access.
create table terminal_ai_audit (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references terminal_users(id),
  deal_id         uuid        references terminal_deals(id),
  conversation_id uuid        references terminal_ai_conversations(id),
  event_type      text        not null,
  payload         jsonb,
  created_at      timestamptz not null default now()
);

create index on terminal_ai_audit(user_id, created_at);
create index on terminal_ai_audit(deal_id, created_at);
create index on terminal_ai_audit(event_type, created_at);
