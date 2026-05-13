-- ============================================================================
-- terminal_dd_documents: source_kind enum + source_ref + storage uniqueness
-- ============================================================================
-- Phase 6 Step 7. Up to now every row in terminal_dd_documents was a dataroom
-- file. Now the same table also holds rows that mirror the deal-level slots
-- on terminal_deals (OM, LOI, PSA, Full Report, CoStar, Tenants, Lease) and
-- the per-address OM on terminal_deal_addresses. source_kind labels where
-- the row came from so we can find / replace / delete the right one when an
-- admin re-uploads or clears a slot.
--
-- PRE-FLIGHT: the unique index will fail to create if any (deal_id,
-- storage_path) pair already has duplicates. Run this first and resolve any
-- rows it returns before applying the migration:
--
--   select deal_id, storage_path, count(*)
--   from terminal_dd_documents
--   group by 1, 2 having count(*) > 1;
--
-- ROLLBACK:
--   drop index if exists terminal_dd_documents_storage_unique;
--   alter table terminal_dd_documents
--     drop column if exists source_ref,
--     drop column if exists source_kind;
--   drop type if exists doc_source_kind;

create type doc_source_kind as enum (
  'dataroom',
  'deal_om',
  'deal_om_address',
  'deal_loi',
  'deal_psa',
  'deal_full_report',
  'deal_costar_report',
  'deal_tenants_report',
  'deal_lease_summary'
);

alter table terminal_dd_documents
  add column source_kind doc_source_kind not null default 'dataroom',
  add column source_ref  uuid;

create unique index terminal_dd_documents_storage_unique
  on terminal_dd_documents (deal_id, storage_path);
