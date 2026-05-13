-- ============================================================================
-- terminal_doc_chunks.embedding_model: correct default → gemini-embedding-2@1536
-- ============================================================================
-- Phase 6 Step 4 used 'gemini-embedding-002' as the model identifier, which
-- is wrong — Google's actual identifier is 'gemini-embedding-2' (no leading
-- zeros). Confirmed against:
--   https://developers.googleblog.com/building-with-gemini-embedding-2/
--   https://ai.google.dev/gemini-api/docs/models
-- The Vercel embed.ts + n8n Gemini Batch Embed URL/body are corrected in
-- lockstep with this migration.
--
-- ROLLBACK:
--   alter table terminal_doc_chunks
--     alter column embedding_model set default 'gemini-embedding-002@1536';

alter table terminal_doc_chunks
  alter column embedding_model set default 'gemini-embedding-2@1536';
