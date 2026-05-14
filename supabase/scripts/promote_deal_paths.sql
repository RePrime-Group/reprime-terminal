-- Phase 6 Step 8a — promote existing deal-level slot paths into terminal_dd_documents.
--
-- terminal_deals has 7 path columns and terminal_deal_addresses has 1 (per-address OM).
-- When admin uploaded to those slots the file went to storage but never got a
-- terminal_dd_documents row, so RAG never saw it. This creates the missing rows
-- as indexing_status='pending' so the backfill cron picks them up.
--
-- Idempotent: ON CONFLICT (deal_id, storage_path) DO NOTHING. Safe to re-run.
-- Run once, then watch:  select indexing_status, count(*) from terminal_dd_documents group by 1;

insert into terminal_dd_documents
  (deal_id, folder_id, name, display_name, file_type, storage_path,
   uploaded_by, source_kind, indexing_status)
select id, null::uuid, 'Offering Memorandum', 'Offering Memorandum',
       'application/pdf', om_storage_path, null::uuid,
       'deal_om'::doc_source_kind, 'pending'::doc_indexing_status
  from terminal_deals where om_storage_path is not null
union all
select id, null, 'Signed LOI', 'Signed LOI',
       'application/pdf', loi_signed_storage_path, null, 'deal_loi', 'pending'
  from terminal_deals where loi_signed_storage_path is not null
union all
select id, null, 'Purchase and Sale Agreement', 'Purchase and Sale Agreement',
       'application/pdf', psa_storage_path, null, 'deal_psa', 'pending'
  from terminal_deals where psa_storage_path is not null
union all
select id, null, 'Full Report', 'Full Report',
       'application/pdf', full_report_storage_path, null, 'deal_full_report', 'pending'
  from terminal_deals where full_report_storage_path is not null
union all
select id, null, 'CoStar Report', 'CoStar Report',
       'application/pdf', costar_report_storage_path, null, 'deal_costar_report', 'pending'
  from terminal_deals where costar_report_storage_path is not null
union all
select id, null, 'Tenants Report', 'Tenants Report',
       'application/pdf', tenants_report_storage_path, null, 'deal_tenants_report', 'pending'
  from terminal_deals where tenants_report_storage_path is not null
union all
select id, null, 'Lease Summary', 'Lease Summary',
       'application/pdf', lease_summary_storage_path, null, 'deal_lease_summary', 'pending'
  from terminal_deals where lease_summary_storage_path is not null

-- terminal_deal_addresses per-address OMs
union all
select a.deal_id, null,
       'Offering Memorandum — ' || coalesce(a.label, a.address, 'address'),
       'Offering Memorandum — ' || coalesce(a.label, a.address, 'address'),
       'application/pdf', a.om_storage_path, null, 'deal_om_address', 'pending'
  from terminal_deal_addresses a where a.om_storage_path is not null

on conflict (deal_id, storage_path) do nothing;
