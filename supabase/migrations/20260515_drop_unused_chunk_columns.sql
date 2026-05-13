-- ============================================================================
-- terminal_doc_chunks: drop unused page_start / page_end / token_count
-- ============================================================================
-- Phase 6 Step 3. These columns were always null (Docling markdown output has
-- no page markers) or written-but-never-read (token_count — cost auditing
-- happens at API-call level, not chunk-level). The search_doc_chunks RPC has
-- to be dropped first because it includes them in its RETURNS TABLE; we
-- recreate it without the page columns at the bottom of this migration.
--
-- ROLLBACK:
--   drop function if exists search_doc_chunks(vector, uuid, text, int);
--   alter table terminal_doc_chunks
--     add column if not exists page_start  int,
--     add column if not exists page_end    int,
--     add column if not exists token_count int;
--   -- then re-apply the original search_doc_chunks body from
--   -- 20260514_search_doc_chunks_rpc.sql.

drop function if exists search_doc_chunks(vector, uuid, text, int);

alter table terminal_doc_chunks
  drop column page_start,
  drop column page_end,
  drop column token_count;

create or replace function search_doc_chunks(
  query_embedding vector(1536),
  p_deal_id       uuid,
  query_text      text,
  k               int default 40
)
returns table (
  id          uuid,
  document_id uuid,
  content     text,
  title       text,
  rrf         double precision
)
language sql
stable
security definer
set search_path = public
as $$
  with semantic as (
    select c.id,
           row_number() over (order by c.embedding <=> query_embedding) as rn
    from terminal_doc_chunks c
    where c.deal_id = p_deal_id
    order by c.embedding <=> query_embedding
    limit k
  ),
  lexical as (
    select c.id,
           row_number() over (
             order by ts_rank(c.content_tsv, plainto_tsquery('english', query_text)) desc
           ) as rn
    from terminal_doc_chunks c
    where c.deal_id = p_deal_id
      and c.content_tsv @@ plainto_tsquery('english', query_text)
    order by ts_rank(c.content_tsv, plainto_tsquery('english', query_text)) desc
    limit k
  ),
  fused as (
    select id, sum(1.0 / (60 + rn)) as rrf
    from (
      select id, rn from semantic
      union all
      select id, rn from lexical
    ) r
    group by id
  )
  select c.id,
         c.document_id,
         c.content,
         d.name as title,
         f.rrf
  from terminal_doc_chunks c
    join fused f on c.id = f.id
    join terminal_dd_documents d on d.id = c.document_id
  order by f.rrf desc
  limit k;
$$;

revoke all on function search_doc_chunks(vector, uuid, text, int) from public;
grant execute on function search_doc_chunks(vector, uuid, text, int)
  to authenticated, service_role;
