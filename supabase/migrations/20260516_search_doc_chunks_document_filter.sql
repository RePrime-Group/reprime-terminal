-- ============================================================================
-- search_doc_chunks: optional per-document filter
-- ============================================================================
-- Phase 6 Step 5 follow-up. Without this, a question targeting a short doc
-- (e.g., a 1-chunk LOI) gets drowned out by longer docs on the same deal —
-- top-K results come back dominated by the longer doc's chunks. With the
-- new p_document_id param the agent can scope retrieval to one specific
-- document when the user names it, eliminating cross-doc fact bleed.
--
-- Backward compatible: p_document_id defaults to NULL → no filter, same
-- behavior as before. Existing PostgREST callers (retrieval workflow) keep
-- working unchanged until they choose to send the new field.
--
-- ROLLBACK:
--   drop function if exists search_doc_chunks(vector, uuid, text, int, uuid);
--   -- then re-apply the prior body from
--   -- 20260515_drop_unused_chunk_columns.sql

drop function if exists search_doc_chunks(vector, uuid, text, int);

create or replace function search_doc_chunks(
  query_embedding vector(1536),
  p_deal_id       uuid,
  query_text      text,
  k               int  default 40,
  p_document_id   uuid default null
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
      and (p_document_id is null or c.document_id = p_document_id)
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
      and (p_document_id is null or c.document_id = p_document_id)
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

revoke all on function search_doc_chunks(vector, uuid, text, int, uuid) from public;
grant execute on function search_doc_chunks(vector, uuid, text, int, uuid)
  to authenticated, service_role;
