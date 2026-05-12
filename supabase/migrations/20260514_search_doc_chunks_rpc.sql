-- ============================================================================
-- search_doc_chunks(query_embedding, p_deal_id, query_text, k) RPC
-- ============================================================================
-- Hybrid retrieval (semantic + lexical → Reciprocal Rank Fusion) for the
-- Phase 5 RAG tool. Called from /api/ai/search-documents under the
-- service-role client — the route validates the N8N_INTERNAL_TOKEN and trusts
-- p_deal_id from the request body.
--
-- This is intentionally SECURITY DEFINER so the function can run the CTE
-- without RLS, but the function:
--   - never reads or returns any column outside terminal_doc_chunks +
--     terminal_dd_documents.name,
--   - always filters by p_deal_id,
--   - has no write side-effect,
-- which matches the security model of the existing compute_scenario RPC
-- pattern (service-role client behind internal-token auth).
--
-- ROLLBACK:
--   drop function if exists search_doc_chunks(vector, uuid, text, int);

create or replace function search_doc_chunks(
  query_embedding vector(1536),
  p_deal_id       uuid,
  query_text      text,
  k               int default 40
)
returns table (
  id          uuid,
  document_id uuid,
  page_start  int,
  page_end    int,
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
         c.page_start,
         c.page_end,
         c.content,
         d.name as title,
         f.rrf
  from terminal_doc_chunks c
    join fused f on c.id = f.id
    join terminal_dd_documents d on d.id = c.document_id
  order by f.rrf desc
  limit k;
$$;

-- Restrict invocation: only the service-role client (which the internal
-- /api/ai/search-documents route uses) and an authenticated session should
-- be able to call this. Anon is denied.
revoke all on function search_doc_chunks(vector, uuid, text, int) from public;
grant execute on function search_doc_chunks(vector, uuid, text, int)
  to authenticated, service_role;
