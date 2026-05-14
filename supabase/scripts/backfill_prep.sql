-- ============================================================================
-- Backfill prep — run ONCE before enabling the backfill. Copy-paste the whole
-- thing into the Supabase SQL editor and run it.
--
-- Does three things, in order, atomically:
--   1. De-dupe   — removes duplicate terminal_dd_documents rows (same file twice)
--   2. Promote   — creates rows for deal-level slot paths (OM/LOI/PSA/etc.)
--   3. Reset     — sets every non-succeeded row to a clean pending/attempts=0
--                  state so the `attempts < 1` backfill filter will pick it up
--
-- Optional pre-check — run this by itself first if you want to eyeball the
-- duplicates before they're deleted:
--   select deal_id, name, count(*)
--     from terminal_dd_documents group by deal_id, name
--    having count(*) > 1 order by 3 desc;
-- ============================================================================

begin;

-- ── 1. De-dupe ──────────────────────────────────────────────────────────────
-- Keep ONE row per (deal_id, name): prefer a 'succeeded' row, else the newest.
-- Chunks of deleted rows cascade-delete via the existing FK.
with ranked as (
  select id,
         row_number() over (
           partition by deal_id, name
           order by (indexing_status = 'succeeded') desc,
                    created_at desc
         ) as rn
    from terminal_dd_documents
)
delete from terminal_dd_documents
 where id in (select id from ranked where rn > 1);

-- ── 2. Promote deal-level slot paths ────────────────────────────────────────
-- terminal_deals slot columns + terminal_deal_addresses per-address OMs.
-- Idempotent: on conflict (deal_id, storage_path) do nothing.
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
union all
select a.deal_id, null,
       'Offering Memorandum — ' || coalesce(a.label, a.address, 'address'),
       'Offering Memorandum — ' || coalesce(a.label, a.address, 'address'),
       'application/pdf', a.om_storage_path, null, 'deal_om_address', 'pending'
  from terminal_deal_addresses a where a.om_storage_path is not null
on conflict (deal_id, storage_path) do nothing;

-- ── 3. Reset ────────────────────────────────────────────────────────────────
-- Clear today's test pollution: every non-succeeded row back to pending,
-- attempts=0, last_error=null. Without this the `attempts < 1` filter picks
-- up nothing.
update terminal_dd_documents
   set indexing_status = 'pending',
       attempts        = 0,
       last_error      = null
 where indexing_status <> 'succeeded';

commit;

-- ── Sanity check (run after commit) ─────────────────────────────────────────
-- select indexing_status, count(*) from terminal_dd_documents group by 1;
