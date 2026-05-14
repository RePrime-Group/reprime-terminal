-- De-duplicate terminal_dd_documents rows.
--
-- Some files ended up with 2+ rows on the same deal (same `name`, different
-- `storage_path` / `id`) — e.g. uploaded twice, or promoted twice. The backfill
-- then processes each row separately, OCRing the same file multiple times.
--
-- This keeps ONE row per (deal_id, name): preferring a 'succeeded' row, then the
-- most recently created. Deleting a duplicate row cascade-deletes its chunks.
--
-- ⚠️ AUDIT BEFORE DELETE. Run STEP 1 first, eyeball the groups, then run STEP 2.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — review: list every (deal_id, name) that has more than one row.
-- ─────────────────────────────────────────────────────────────────────────────
select deal_id,
       name,
       count(*)                                   as row_count,
       array_agg(id order by created_at)          as document_ids,
       array_agg(indexing_status order by created_at) as statuses,
       array_agg(storage_path order by created_at)    as storage_paths
  from terminal_dd_documents
 group by deal_id, name
having count(*) > 1
 order by row_count desc, deal_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — delete duplicates, keeping the best row per (deal_id, name).
-- "Best" = a 'succeeded' row if one exists, otherwise the newest by created_at.
-- Chunks of deleted rows cascade-delete via the existing FK.
-- ─────────────────────────────────────────────────────────────────────────────
with ranked as (
  select id,
         row_number() over (
           partition by deal_id, name
           order by (indexing_status = 'succeeded') desc,  -- keep succeeded first
                    created_at desc                        -- then newest
         ) as rn
    from terminal_dd_documents
)
delete from terminal_dd_documents
 where id in (select id from ranked where rn > 1);
