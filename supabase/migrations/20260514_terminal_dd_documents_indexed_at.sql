-- ============================================================================
-- terminal_dd_documents: indexed_at + do_not_index for RAG ingestion
-- ============================================================================
-- - indexed_at: when the ingestion workflow last embedded this doc into
--   terminal_doc_chunks. Null = not yet indexed; the backfill workflow
--   picks these rows.
-- - do_not_index: gate for KYC/privileged docs that must never be embedded.
--   Default false so existing rows are eligible.
--
-- ROLLBACK:
--   drop index if exists terminal_dd_documents_indexed_at_null_idx;
--   alter table terminal_dd_documents drop column if exists indexed_at;
--   alter table terminal_dd_documents drop column if exists do_not_index;

alter table terminal_dd_documents
  add column if not exists indexed_at  timestamptz,
  add column if not exists do_not_index boolean not null default false;

create index if not exists terminal_dd_documents_indexed_at_null_idx
  on terminal_dd_documents (deal_id)
  where indexed_at is null and do_not_index = false;
