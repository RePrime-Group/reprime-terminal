-- ============================================================================
-- replace_doc_chunks(p_document_id, p_deal_id, p_chunks) RPC
-- ============================================================================
-- Atomic DELETE-then-INSERT for terminal_doc_chunks. The Phase 5 ingestion
-- workflow calls this once per document so a re-ingest fully replaces the
-- chunks instead of appending duplicates.
--
-- Input p_chunks shape (jsonb array):
--   [
--     {
--       "chunk_index":   0,
--       "page_start":    null,
--       "page_end":      null,
--       "content":       "...",
--       "context":       "...",            -- Haiku-generated; may be null
--       "embedding":     [0.0, ...],       -- 1536 floats
--       "token_count":   123                -- optional
--     }, ...
--   ]
--
-- Returns the inserted chunk count.
--
-- ROLLBACK:
--   drop function if exists replace_doc_chunks(uuid, uuid, jsonb);

create or replace function replace_doc_chunks(
  p_document_id uuid,
  p_deal_id     uuid,
  p_chunks      jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted int;
begin
  delete from terminal_doc_chunks where document_id = p_document_id;

  insert into terminal_doc_chunks
    (document_id, deal_id, chunk_index, page_start, page_end,
     content, context, embedding, token_count)
  select
    p_document_id,
    p_deal_id,
    (c->>'chunk_index')::int,
    nullif(c->>'page_start','')::int,
    nullif(c->>'page_end','')::int,
    c->>'content',
    nullif(c->>'context',''),
    (c->>'embedding')::vector,
    nullif(c->>'token_count','')::int
  from jsonb_array_elements(p_chunks) as c;

  get diagnostics inserted = row_count;

  update terminal_dd_documents
     set indexed_at = now()
   where id = p_document_id;

  return inserted;
end;
$$;

revoke all on function replace_doc_chunks(uuid, uuid, jsonb) from public;
grant execute on function replace_doc_chunks(uuid, uuid, jsonb)
  to authenticated, service_role;
