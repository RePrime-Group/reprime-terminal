-- Reconcile drifted deal-level + per-address document paths.
--
-- 20260722_backfill_deal_docs_into_dd_documents.sql (and the 20260519 address
-- backfill) only INSERTED rows for slots with no existing terminal_dd_documents
-- row. Where a mirror row already existed (from an earlier promoteDealDocAction)
-- it was left untouched — even when the legacy terminal_deals/terminal_deal_
-- addresses column had since been re-uploaded to a newer file. Result: the dd
-- row points at a superseded (often deleted) storage object while the legacy
-- column holds the current file. Now that reads come from dd_documents, those
-- downloads break.
--
-- For legacy-style rows (sha256 IS NULL — i.e. NOT a new content-addressed
-- upload, which owns its own row), the legacy column is the source of truth for
-- the current file. Repoint the dd row to it and reset its indexing state +
-- drop stale chunks so RAG re-ingests the correct file. Content-addressed rows
-- (sha256 IS NOT NULL) are never touched.
--
-- Idempotent: the `is distinct from` guard makes re-runs no-ops.
--
-- ROLLBACK: none — this only corrects storage_path to match the legacy columns,
-- which still exist until 20260724_drop_legacy_file_columns.sql.

-- ── Deal-level slots ────────────────────────────────────────────────────────
with slot as (
  select t.id as deal_id, s.name, s.col_path
  from terminal_deals t
  cross join lateral (values
    (t.om_storage_path,            'offering-memorandum'),
    (t.loi_signed_storage_path,    'loi-signed'),
    (t.psa_storage_path,           'purchase-sale-agreement'),
    (t.full_report_storage_path,   'full-report'),
    (t.costar_report_storage_path, 'costar-report'),
    (t.tenants_report_storage_path,'tenants-report'),
    (t.lease_summary_storage_path, 'lease-summary')
  ) as s(col_path, name)
  where s.col_path is not null
),
repointed as (
  update terminal_dd_documents d
     set storage_path    = slot.col_path,
         sha256          = null,
         md_content      = null,
         indexing_status = 'pending',
         indexed_at      = null,
         attempts        = 0,
         last_error      = null
    from slot
   where d.deal_id = slot.deal_id
     and d.name = slot.name
     and d.sha256 is null
     and d.storage_path is distinct from slot.col_path
  returning d.id
)
delete from terminal_doc_chunks c
using repointed r
where c.document_id = r.id;

-- ── Per-address OMs ─────────────────────────────────────────────────────────
with repointed as (
  update terminal_dd_documents d
     set storage_path    = a.om_storage_path,
         sha256          = null,
         md_content      = null,
         indexing_status = 'pending',
         indexed_at      = null,
         attempts        = 0,
         last_error      = null
    from terminal_deal_addresses a
   where d.deal_id = a.deal_id
     and d.name = 'offering-memorandum-' || substring(a.id::text, 1, 8)
     and a.om_storage_path is not null
     and d.sha256 is null
     and d.storage_path is distinct from a.om_storage_path
  returning d.id
)
delete from terminal_doc_chunks c
using repointed r
where c.document_id = r.id;
