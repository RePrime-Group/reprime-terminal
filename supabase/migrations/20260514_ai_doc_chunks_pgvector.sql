-- ============================================================================
-- RAG over deal documents — terminal_doc_chunks
-- ============================================================================
-- Phase 5. Stores chunked, contextualized, embedded text from
-- terminal_dd_documents so the chat agent can answer qualitative dataroom
-- questions via /api/ai/search-documents.
--
-- Embedding dim is fixed for Gemini gemini-embedding-001 with
-- output_dimensionality = 1536. Gemini supports 768 / 1536 / 3072 via
-- Matryoshka truncation; 1536 is the cost/quality sweet spot.
-- If output_dimensionality changes, also change vector(1536) and bump
-- embedding_model — chunks at different dims cannot coexist.
--
-- ROLLBACK:
--   drop table if exists terminal_doc_chunks;

create extension if not exists vector;

create table terminal_doc_chunks (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references terminal_dd_documents(id) on delete cascade,
  deal_id         uuid not null references terminal_deals(id) on delete cascade,
  chunk_index     int  not null,
  page_start      int,
  page_end        int,
  content         text not null,
  context         text,
  indexed_text    text generated always as
                    (coalesce(context, '') || E'\n\n' || content) stored,
  content_tsv     tsvector generated always as
                    (to_tsvector('english', coalesce(context, '') || ' ' || content)) stored,
  embedding       vector(1536),
  embedding_model text not null default 'gemini-embedding-001@1536',
  token_count     int,
  created_at      timestamptz not null default now(),
  unique (document_id, chunk_index)
);
