-- ============================================================================
-- terminal_doc_chunks.embedding_model: default → gemini-embedding-002@1536
-- ============================================================================
-- Phase 6 Step 4. New ingestions write 002 chunks. Existing 001@1536 rows are
-- left in place (test data, not bulk-deleted in this phase). The Vercel
-- `EMBEDDING_MODEL` constant and the n8n Gemini Batch Embed URL flip in
-- lockstep with this migration.
--
-- ROLLBACK:
--   alter table terminal_doc_chunks
--     alter column embedding_model set default 'gemini-embedding-001@1536';

alter table terminal_doc_chunks
  alter column embedding_model set default 'gemini-embedding-002@1536';
