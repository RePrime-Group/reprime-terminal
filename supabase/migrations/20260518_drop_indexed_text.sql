-- ============================================================================
-- terminal_doc_chunks: drop unused indexed_text generated column
-- ============================================================================
-- Phase 6 cleanup. indexed_text was a STORED GENERATED column defined as
-- (coalesce(context,'') || E'\n\n' || content). It was originally added as
-- a convenience for embedding/FTS, but nothing reads it:
--   - search_doc_chunks RPC returns content, not indexed_text
--   - lexical search uses content_tsv (separate generated tsvector)
--   - vector search uses embedding
--   - no code/script references it (grep src/ scripts/ → zero hits)
-- Dropping it reclaims disk and clears the column out of the schema.
--
-- ROLLBACK:
--   alter table terminal_doc_chunks
--     add column indexed_text text generated always as
--       (coalesce(context, '') || E'\n\n' || content) stored;

alter table terminal_doc_chunks
  drop column if exists indexed_text;
