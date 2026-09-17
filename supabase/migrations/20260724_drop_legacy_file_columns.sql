-- Drop the legacy file-pointer columns now that terminal_dd_documents is the
-- single source of truth for these files.
--
-- PRECONDITIONS (all shipped + verified before running this):
--   * 20260722_backfill_deal_docs_into_dd_documents.sql        (7 deal slots)
--   * 20260519_backfill_address_oms_into_dd_documents.sql      (per-address OM)
--   * 20260722_task_attachments_attachment_id.sql              (attachment_id + rows)
--   * 20260722_task_attachments_folder_backfill.sql            (folder placement)
--   * 20260723_reconcile_deal_doc_paths.sql                    (repoint drifted paths)
--   * App reads/writes only terminal_dd_documents for these files.
--
-- Columns dropped:
--   terminal_deals: om_storage_path, loi_signed_storage_path, psa_storage_path,
--     full_report_storage_path, costar_report_storage_path,
--     tenants_report_storage_path, lease_summary_storage_path
--   terminal_deal_addresses: om_storage_path
--   terminal_task_attachments: storage_path, investor_folder_id
--
-- terminal_deal_photos.storage_path is intentionally NOT dropped.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK — re-add the columns and repopulate from terminal_dd_documents (the
-- source of truth). Reconstructs the exact pointers; after the file-migration
-- script moves objects to deal/sha256.ext the restored paths point at the new
-- (still valid) locations. Run the whole block to restore.
--
--   alter table public.terminal_deals
--     add column if not exists om_storage_path             text,
--     add column if not exists loi_signed_storage_path     text,
--     add column if not exists psa_storage_path            text,
--     add column if not exists full_report_storage_path    text,
--     add column if not exists costar_report_storage_path  text,
--     add column if not exists tenants_report_storage_path text,
--     add column if not exists lease_summary_storage_path  text;
--
--   update terminal_deals t set
--     om_storage_path             = d.om,
--     loi_signed_storage_path     = d.loi,
--     psa_storage_path            = d.psa,
--     full_report_storage_path    = d.full_report,
--     costar_report_storage_path  = d.costar,
--     tenants_report_storage_path = d.tenants,
--     lease_summary_storage_path  = d.lease
--   from (
--     select deal_id,
--       max(storage_path) filter (where name = 'offering-memorandum')     as om,
--       max(storage_path) filter (where name = 'loi-signed')              as loi,
--       max(storage_path) filter (where name = 'purchase-sale-agreement') as psa,
--       max(storage_path) filter (where name = 'full-report')             as full_report,
--       max(storage_path) filter (where name = 'costar-report')           as costar,
--       max(storage_path) filter (where name = 'tenants-report')          as tenants,
--       max(storage_path) filter (where name = 'lease-summary')           as lease
--     from terminal_dd_documents
--     group by deal_id
--   ) d
--   where d.deal_id = t.id;
--
--   alter table public.terminal_deal_addresses
--     add column if not exists om_storage_path text;
--
--   update terminal_deal_addresses a set
--     om_storage_path = d.storage_path
--   from terminal_dd_documents d
--   where d.deal_id = a.deal_id
--     and d.name = 'offering-memorandum-' || substring(a.id::text, 1, 8);
--
--   alter table public.terminal_task_attachments
--     add column if not exists storage_path       text,
--     add column if not exists investor_folder_id uuid
--       references public.terminal_dd_folders(id);
--
--   update terminal_task_attachments a set
--     storage_path       = d.storage_path,
--     investor_folder_id = d.folder_id
--   from terminal_dd_documents d
--   where d.id = a.attachment_id;
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.terminal_deals
  drop column if exists om_storage_path,
  drop column if exists loi_signed_storage_path,
  drop column if exists psa_storage_path,
  drop column if exists full_report_storage_path,
  drop column if exists costar_report_storage_path,
  drop column if exists tenants_report_storage_path,
  drop column if exists lease_summary_storage_path;

alter table public.terminal_deal_addresses
  drop column if exists om_storage_path;

alter table public.terminal_task_attachments
  drop column if exists storage_path,
  drop column if exists investor_folder_id;
