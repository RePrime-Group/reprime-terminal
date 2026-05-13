-- ============================================================================
-- mark_doc_processing(p_id) / mark_doc_failed(p_id, p_error) RPCs
-- ============================================================================
-- Phase 6 Step 5. The n8n ingestion workflow needs to atomically transition
-- a document to 'processing' (with attempts++) up front, and to 'failed'
-- (with last_error) on any error-path node. PostgREST can't express
-- `attempts = attempts + 1` in a PATCH, so we expose these as RPCs.
--
-- The 'succeeded' transition already lives inside replace_doc_chunks v2 —
-- no separate RPC needed for that path.
--
-- ROLLBACK:
--   drop function if exists mark_doc_processing(uuid);
--   drop function if exists mark_doc_failed(uuid, text);

create or replace function mark_doc_processing(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update terminal_dd_documents
     set indexing_status = 'processing',
         attempts        = attempts + 1
   where id = p_id;
$$;

create or replace function mark_doc_failed(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update terminal_dd_documents
     set indexing_status = 'failed',
         last_error      = left(coalesce(p_error, ''), 2000)
   where id = p_id;
$$;

revoke all on function mark_doc_processing(uuid)      from public;
revoke all on function mark_doc_failed(uuid, text)    from public;
grant execute on function mark_doc_processing(uuid)   to authenticated, service_role;
grant execute on function mark_doc_failed(uuid, text) to authenticated, service_role;
