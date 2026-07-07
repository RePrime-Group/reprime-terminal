-- Migration: add sha256 (dedup) + md_content (cache Docling markdown) to terminal_dd_documents
-- Target: Supabase project kytvpaczfiajyjqohzri
-- Safe to re-run (idempotent).

ALTER TABLE public.terminal_dd_documents
  ADD COLUMN IF NOT EXISTS sha256     text,
  ADD COLUMN IF NOT EXISTS md_content text;

-- Dedup scope is per-deal: the same file can legitimately belong to two deals
-- (different storage paths). Full (non-partial) unique index, so it can serve as an
-- `ON CONFLICT (deal_id, sha256) DO NOTHING` arbiter WITHOUT naming a predicate.
-- sha256 is a new column so all existing rows are NULL; Postgres treats NULLs as
-- distinct (default NULLS DISTINCT), so they never collide, creation succeeds, and
-- rows with a NULL sha256 are simply never deduplicated.
CREATE UNIQUE INDEX IF NOT EXISTS terminal_dd_documents_deal_sha256_uniq
  ON public.terminal_dd_documents (deal_id, sha256);
COMMENT ON COLUMN public.terminal_dd_documents.sha256     IS 'Hex sha256 of the original file bytes; also the storage object name (deal-id/sha256-hex).';
COMMENT ON COLUMN public.terminal_dd_documents.md_content IS 'Docling-converted markdown, cached so downstream indexing can skip re-conversion.';
