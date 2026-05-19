-- Backfill per-address OMs into terminal_dd_documents so RAG ingestion sees
-- them. Mirrors the in-flight admin upload path in src/lib/ai/rag/actions.ts
-- which already writes new uploads with name = 'offering-memorandum-<8-prefix>'.
--
-- Idempotent: skips rows where the (deal_id, name) pair is already present
-- (uniqueness enforced by terminal_dd_documents_deal_name_unique).
--
-- ROLLBACK (best-effort):
--   delete from terminal_dd_documents
--   where name like 'offering-memorandum-%'
--     and length(name) = ('offering-memorandum-'::text || repeat('x', 8))::int  -- 28
--     and exists (
--       select 1 from terminal_deal_addresses a
--       where a.deal_id = terminal_dd_documents.deal_id
--         and substring(a.id::text, 1, 8) = substring(terminal_dd_documents.name, length('offering-memorandum-') + 1)
--         and a.om_storage_path = terminal_dd_documents.storage_path
--     );

insert into terminal_dd_documents (
  deal_id,
  folder_id,
  storage_path,
  name,
  display_name,
  file_type,
  indexing_status,
  created_at
)
select
  a.deal_id,
  null::uuid as folder_id,
  a.om_storage_path as storage_path,
  ('offering-memorandum-' || substring(a.id::text, 1, 8)) as name,
  ('Offering Memorandum — ' || a.label) as display_name,
  'application/pdf' as file_type,
  'pending' as indexing_status,
  now() as created_at
from terminal_deal_addresses a
where a.om_storage_path is not null
  and not exists (
    select 1 from terminal_dd_documents d
    where d.deal_id = a.deal_id
      and (
        d.storage_path = a.om_storage_path
        or d.name = ('offering-memorandum-' || substring(a.id::text, 1, 8))
      )
  );
