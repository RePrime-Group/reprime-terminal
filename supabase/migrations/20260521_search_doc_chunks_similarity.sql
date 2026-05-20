-- ============================================================================
-- search_doc_chunks: expose cosine similarity + optional similarity threshold
-- ============================================================================
-- Adds a `similarity` column (cosine similarity, 0..1; multiply by 100 for a
-- match %) so callers can see how strongly each chunk matches the query, and an
-- optional `min_similarity` floor to drop weak matches. RRF still drives the
-- ordering (hybrid semantic + lexical); similarity is additive and the threshold
-- defaults to 0 so existing callers (retrieval workflow, /api/ai/search-documents)
-- keep working unchanged — the extra column is simply ignored if unused.
--
-- `<=>` is pgvector cosine DISTANCE, so cosine SIMILARITY = 1 - distance.
--
-- ROLLBACK:
--   drop function if exists search_doc_chunks(vector, uuid, text, int, uuid, double precision);
--   -- then re-apply the prior body from 20260516_search_doc_chunks_document_filter.sql

-- Return type changes (new `similarity` column) → must drop before recreate.
drop function if exists search_doc_chunks(vector, uuid, text, int, uuid);

create or replace function search_doc_chunks(
  query_embedding vector(1536),
  p_deal_id       uuid,
  query_text      text,
  k               int              default 40,
  p_document_id   uuid             default null,
  min_similarity  double precision default 0
)
returns table (
  id          uuid,
  document_id uuid,
  content     text,
  title       text,
  similarity  double precision,   -- cosine similarity 0..1 (x100 = match %)
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
      and c.embedding is not null
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
         -- cosine similarity to the query (null only if the chunk has no embedding)
         case when c.embedding is null
              then null
              else (1 - (c.embedding <=> query_embedding))::double precision
         end as similarity,
         f.rrf
  from terminal_doc_chunks c
    join fused f on c.id = f.id
    join terminal_dd_documents d on d.id = c.document_id
  where min_similarity <= 0
     or (c.embedding is not null
         and (1 - (c.embedding <=> query_embedding)) >= min_similarity)
  order by f.rrf desc
  limit k;
$$;

revoke all on function search_doc_chunks(vector, uuid, text, int, uuid, double precision) from public;
grant execute on function search_doc_chunks(vector, uuid, text, int, uuid, double precision)
  to authenticated, service_role;
