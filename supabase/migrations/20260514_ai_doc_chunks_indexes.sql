-- ============================================================================
-- terminal_doc_chunks indexes + RLS
-- ============================================================================
-- HNSW for vector search, GIN for tsvector, btree on deal_id.
-- RLS mirrors the terminal_dd_documents policies verbatim so the two cannot
-- drift.
--
-- ROLLBACK:
--   drop policy if exists "Owners and employees see all chunks" on terminal_doc_chunks;
--   drop policy if exists "Investors see chunks of visible deals" on terminal_doc_chunks;
--   drop policy if exists "Investors see chunks of marketplace deals" on terminal_doc_chunks;
--   drop index if exists terminal_doc_chunks_embedding_hnsw_idx;
--   drop index if exists terminal_doc_chunks_content_tsv_idx;
--   drop index if exists terminal_doc_chunks_deal_id_idx;
--   alter table terminal_doc_chunks disable row level security;
--   revoke select on terminal_doc_chunks from reprime_ai_read;

create index terminal_doc_chunks_embedding_hnsw_idx
  on terminal_doc_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index terminal_doc_chunks_content_tsv_idx
  on terminal_doc_chunks using gin (content_tsv);

create index terminal_doc_chunks_deal_id_idx
  on terminal_doc_chunks (deal_id);

alter table terminal_doc_chunks enable row level security;

-- Mirror the three terminal_dd_documents policies (002_terminal_rls.sql +
-- 20260427_nda_kyc_marketplace_roles.sql) verbatim, joining through
-- terminal_dd_documents so the chunks are exactly as visible as their parent
-- document.

create policy "Owners and employees see all chunks"
  on terminal_doc_chunks
  for all
  using (terminal_user_role() in ('owner', 'employee'));

create policy "Investors see chunks of visible deals"
  on terminal_doc_chunks
  for select
  using (
    terminal_user_role() = 'investor'
    and deal_id in (
      select id from terminal_deals where status in ('published', 'assigned', 'closed')
    )
  );

create policy "Investors see chunks of marketplace deals"
  on terminal_doc_chunks
  for select
  using (
    terminal_user_role() = 'investor'
    and deal_id in (
      select id from terminal_deals where status = 'marketplace'
    )
  );

-- Extend the existing read-only role used by the future MCP tier.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'reprime_ai_read') then
    execute 'grant select on terminal_doc_chunks to reprime_ai_read';
  end if;
end$$;
