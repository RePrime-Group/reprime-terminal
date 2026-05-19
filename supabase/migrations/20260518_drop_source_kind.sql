-- ============================================================================
-- terminal_dd_documents: drop source_kind / source_ref, use name as identifier
-- ============================================================================
-- Replaces the source_kind enum + source_ref FK with a convention:
--   * dataroom files keep their original filenames in `name`
--   * deal-level slot docs use a fixed kebab slug as `name`
--     ('offering-memorandum', 'loi-signed', 'purchase-sale-agreement',
--      'full-report', 'costar-report', 'tenants-report', 'lease-summary')
--   * per-address OM uses 'offering-memorandum-<8-char-address-id-prefix>'
-- A unique index on (deal_id, name) enforces one slot per deal.
--
-- terminal_deals.<slot>_storage_path columns are NOT changed by this
-- migration. They remain the canonical storage pointer; terminal_dd_documents
-- continues to mirror them for RAG indexing/citations, just identified by
-- name instead of source_kind.
--
-- ROLLBACK:
--   drop index if exists terminal_dd_documents_deal_name_unique;
--   create type doc_source_kind as enum (
--     'dataroom','deal_om','deal_om_address','deal_loi','deal_psa',
--     'deal_full_report','deal_costar_report','deal_tenants_report',
--     'deal_lease_summary'
--   );
--   alter table terminal_dd_documents
--     add column source_kind doc_source_kind not null default 'dataroom',
--     add column source_ref  uuid;
--   -- repopulating source_kind/source_ref requires hand-mapping kebab names
--   -- back to enum values; see the case-expression below for the mapping.

-- ─── 0. Pre-flight: abort if any dataroom file's name already collides ──────
-- with a slot slug. The migration cannot create the unique index otherwise.
do $$
declare
  collision_count int;
  collision_names text;
begin
  select count(*), string_agg(distinct name, ', ')
    into collision_count, collision_names
  from terminal_dd_documents
  where source_kind = 'dataroom'
    and name in (
      'offering-memorandum','loi-signed','purchase-sale-agreement',
      'full-report','costar-report','tenants-report','lease-summary'
    );
  if collision_count > 0 then
    raise exception
      'Pre-flight failed: % dataroom row(s) have a name that collides with a slot slug (names: %). Rename these rows before re-running the migration.',
      collision_count, collision_names;
  end if;

  -- Same check for the per-address OM pattern (prefix match).
  select count(*) into collision_count
  from terminal_dd_documents
  where source_kind = 'dataroom'
    and name like 'offering-memorandum-%';
  if collision_count > 0 then
    raise exception
      'Pre-flight failed: % dataroom row(s) have a name matching the per-address OM prefix (offering-memorandum-*). Rename them before re-running.',
      collision_count;
  end if;
end $$;

-- ─── 1. Backfill name from source_kind ─────────────────────────────────────
-- For deal_om_address rows we'd like to suffix with the address id, but a
-- few orphan rows have source_ref=null. Fall back to the row's own id so
-- the resulting name is still unique and non-null.
update terminal_dd_documents
   set name = case source_kind
     when 'deal_om'              then 'offering-memorandum'
     when 'deal_loi'             then 'loi-signed'
     when 'deal_psa'             then 'purchase-sale-agreement'
     when 'deal_full_report'     then 'full-report'
     when 'deal_costar_report'   then 'costar-report'
     when 'deal_tenants_report'  then 'tenants-report'
     when 'deal_lease_summary'   then 'lease-summary'
     when 'deal_om_address'      then 'offering-memorandum-' || coalesce(
       substring(source_ref::text, 1, 8),
       substring(id::text, 1, 8)
     )
   end
 where source_kind <> 'dataroom';

-- Safety net: make sure the backfill produced a non-null name for every
-- non-dataroom row. If anything slipped through, abort.
do $$
declare
  bad int;
begin
  select count(*) into bad
  from terminal_dd_documents
  where name is null;
  if bad > 0 then
    raise exception 'Backfill left % row(s) with NULL name', bad;
  end if;
end $$;

-- ─── 1b. De-dupe dataroom names per deal ────────────────────────────────────
-- Admins sometimes upload files with the same filename ("March 2019 Checks.pdf"
-- twice). storage_path is already unique (it includes a timestamp), but `name`
-- duplicates would break the unique index. Suffix the older rows with "-2",
-- "-3" etc. so the newest keeps the clean name. display_name is preserved, so
-- the UI still shows the original filename.
with ranked as (
  select id,
         row_number() over (
           partition by deal_id, name
           order by created_at desc, id desc
         ) as rn
  from terminal_dd_documents
)
update terminal_dd_documents d
   set name = d.name || '-' || ranked.rn
  from ranked
 where d.id = ranked.id
   and ranked.rn > 1;

-- ─── 2. Unique index on (deal_id, name) ─────────────────────────────────────
create unique index terminal_dd_documents_deal_name_unique
  on terminal_dd_documents (deal_id, name);

-- ─── 3. Drop source_kind / source_ref / enum ────────────────────────────────
alter table terminal_dd_documents
  drop column source_kind,
  drop column source_ref;

drop type doc_source_kind;
