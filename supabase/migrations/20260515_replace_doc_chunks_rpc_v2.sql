-- ============================================================================
-- replace_doc_chunks(p_document_id, p_deal_id, p_chunks) RPC — v2
-- ============================================================================
-- Phase 6 Step 3. Two changes vs. v1 (20260514_replace_doc_chunks_rpc.sql):
--   1. page_start / page_end / token_count are gone from both the INSERT
--      column list and the JSONB parsing (those columns no longer exist).
--   2. The status update now writes the explicit succeeded state:
--        indexing_status = 'succeeded'
--        indexed_at      = now()
--        last_error      = null
--      so the n8n ingestion workflow only needs to set 'processing' up
--      front and 'failed' on error paths — the success transition is
--      atomic with the chunk insert.
--
-- Input p_chunks shape (jsonb array):
--   [
--     {
--       "chunk_index":   0,
--       "content":       "...",
--       "context":       "...",            -- Haiku-generated; may be null
--       "embedding":     [0.0, ...]        -- 1536 floats
--     }, ...
--   ]
--
-- ROLLBACK:
--   drop function if exists replace_doc_chunks(uuid, uuid, jsonb);
--   -- then re-apply the v1 body from 20260514_replace_doc_chunks_rpc.sql.

drop function if exists replace_doc_chunks(uuid, uuid, jsonb);

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
    (document_id, deal_id, chunk_index, content, context, embedding)
  select
    p_document_id,
    p_deal_id,
    (c->>'chunk_index')::int,
    c->>'content',
    nullif(c->>'context',''),
    (c->>'embedding')::vector
  from jsonb_array_elements(p_chunks) as c;

  get diagnostics inserted = row_count;

  update terminal_dd_documents
     set indexing_status = 'succeeded',
         indexed_at      = now(),
         last_error      = null
   where id = p_document_id;

  return inserted;
end;
$$;

revoke all on function replace_doc_chunks(uuid, uuid, jsonb) from public;
grant execute on function replace_doc_chunks(uuid, uuid, jsonb)
  to authenticated, service_role;
