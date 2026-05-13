-- ============================================================================
-- terminal_dd_documents: explicit indexing_status enum + attempts + last_error
-- ============================================================================
-- Phase 6 Step 2. Replaces the implicit "indexed_at is null = pending" model
-- with an explicit state machine that the n8n ingestion workflow writes
-- (pending → processing → succeeded|failed) and the chat workflow / backfill
-- script read. Drops the unused do_not_index column (never set in app code).
--
-- ROLLBACK:
--   drop index if exists terminal_dd_documents_pending_idx;
--   alter table terminal_dd_documents
--     add column if not exists do_not_index boolean not null default false,
--     drop column if exists last_error,
--     drop column if exists attempts,
--     drop column if exists indexing_status;
--   drop type if exists doc_indexing_status;
--   create index if not exists terminal_dd_documents_indexed_at_null_idx
--     on terminal_dd_documents (deal_id)
--     where indexed_at is null and do_not_index = false;

create type doc_indexing_status as enum (
  'pending', 'processing', 'succeeded', 'failed'
);

alter table terminal_dd_documents
  add column indexing_status doc_indexing_status not null default 'pending',
  add column attempts        int                  not null default 0,
  add column last_error      text;

update terminal_dd_documents
   set indexing_status = case
     when indexed_at is not null then 'succeeded'::doc_indexing_status
     else                             'pending'::doc_indexing_status
   end;

drop index if exists terminal_dd_documents_indexed_at_null_idx;
alter table terminal_dd_documents drop column do_not_index;

create index terminal_dd_documents_pending_idx
  on terminal_dd_documents (deal_id)
  where indexing_status = 'pending';
