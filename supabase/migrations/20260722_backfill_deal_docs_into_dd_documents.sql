-- Backfill the seven deal-level document slots on terminal_deals into
-- terminal_dd_documents so the table is the single source of truth for these
-- files. Rows uploaded before promoteDealDocAction shipped have a
-- terminal_deals.<slot>_storage_path value but no mirrored dd_documents row;
-- without this backfill, flipping downloads/UI to read from dd_documents would
-- break those older deals.
--
-- Mirrors the address-OM backfill (20260519) and the in-flight upload path in
-- src/lib/ai/rag/actions.ts: name = fixed kebab slot slug, display_name = human
-- label. Idempotent: skips any (deal_id, name) or (deal_id, storage_path) that
-- already exists (uniqueness enforced by terminal_dd_documents_deal_name_unique
-- and terminal_dd_documents_storage_unique).
--
-- sha256 is intentionally left NULL here. These rows keep pointing at their
-- existing (legacy) storage paths; the separate file-migration script will move
-- the objects to deal/sha256.ext and populate sha256 at that time.
--
-- ROLLBACK (best-effort): delete the rows this inserted, matched by the slot
-- slug + storage_path still equal to the deal column.
--   delete from terminal_dd_documents d
--   using terminal_deals t
--   where d.deal_id = t.id
--     and (
--       (d.name = 'offering-memorandum'      and d.storage_path = t.om_storage_path)
--       or (d.name = 'loi-signed'               and d.storage_path = t.loi_signed_storage_path)
--       or (d.name = 'purchase-sale-agreement' and d.storage_path = t.psa_storage_path)
--       or (d.name = 'full-report'              and d.storage_path = t.full_report_storage_path)
--       or (d.name = 'costar-report'            and d.storage_path = t.costar_report_storage_path)
--       or (d.name = 'tenants-report'           and d.storage_path = t.tenants_report_storage_path)
--       or (d.name = 'lease-summary'            and d.storage_path = t.lease_summary_storage_path)
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
  t.id as deal_id,
  null::uuid as folder_id,
  s.storage_path,
  s.name,
  s.display_name,
  'application/pdf' as file_type,
  'pending' as indexing_status,
  now() as created_at
from terminal_deals t
cross join lateral (
  values
    (t.om_storage_path,            'offering-memorandum',      'Offering Memorandum'),
    (t.loi_signed_storage_path,    'loi-signed',               'Signed LOI'),
    (t.psa_storage_path,           'purchase-sale-agreement',  'Purchase and Sale Agreement'),
    (t.full_report_storage_path,   'full-report',              'Full Report'),
    (t.costar_report_storage_path, 'costar-report',            'CoStar Report'),
    (t.tenants_report_storage_path,'tenants-report',           'Tenants Report'),
    (t.lease_summary_storage_path, 'lease-summary',            'Lease Summary')
) as s(storage_path, name, display_name)
where s.storage_path is not null
  and not exists (
    select 1 from terminal_dd_documents d
    where d.deal_id = t.id
      and (d.name = s.name or d.storage_path = s.storage_path)
  );
