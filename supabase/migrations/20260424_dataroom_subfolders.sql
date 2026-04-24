-- ============================================================================
-- Data Room: subfolders, document ordering, and rename-without-renaming-storage
--
-- Additive migration. Every existing folder becomes a top-level folder
-- (parent_id = NULL), every existing document gets display_name = name and a
-- sort_order derived from upload time. Live data keeps rendering identically
-- until an admin starts nesting / reordering / renaming.
--
-- parent_id intentionally does NOT cascade on delete. terminal_dd_documents
-- .folder_id has no cascade either (see db.sql:135), so a raw folder DELETE
-- with children would corrupt state. Recursive delete is handled by the
-- /api/dataroom/folders/[id] route, which walks the tree leaf-first and
-- removes storage objects before deleting rows.
-- ============================================================================

-- ── terminal_dd_folders: nesting ────────────────────────────────────────────
ALTER TABLE public.terminal_dd_folders
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES public.terminal_dd_folders(id);

-- Cheap DB-level guard against trivial self-loops. Deeper cycles are
-- prevented in the client by wouldCreateCircle() before the move request
-- and re-validated in the PATCH /api/dataroom/folders/[id] handler.
ALTER TABLE public.terminal_dd_folders
  DROP CONSTRAINT IF EXISTS terminal_dd_folders_no_self_parent;
ALTER TABLE public.terminal_dd_folders
  ADD CONSTRAINT terminal_dd_folders_no_self_parent
  CHECK (parent_id IS NULL OR parent_id <> id);

CREATE INDEX IF NOT EXISTS terminal_dd_folders_parent_id_idx
  ON public.terminal_dd_folders(parent_id);

CREATE INDEX IF NOT EXISTS terminal_dd_folders_deal_parent_order_idx
  ON public.terminal_dd_folders(deal_id, parent_id, display_order);

-- ── terminal_dd_documents: ordering + display name ─────────────────────────
ALTER TABLE public.terminal_dd_documents
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS display_name text;

-- Backfill display_name from the current on-disk name so future renames can
-- change display_name without touching storage paths.
UPDATE public.terminal_dd_documents
   SET display_name = name
 WHERE display_name IS NULL;

-- Backfill sort_order per folder. Oldest upload = 1, newest = N. New uploads
-- append to the end (max + 1) going forward.
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY folder_id ORDER BY created_at, id) AS rn
    FROM public.terminal_dd_documents
)
UPDATE public.terminal_dd_documents d
   SET sort_order = ordered.rn
  FROM ordered
 WHERE d.id = ordered.id
   AND d.sort_order = 0;

CREATE INDEX IF NOT EXISTS terminal_dd_documents_folder_sort_idx
  ON public.terminal_dd_documents(folder_id, sort_order);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- No new policies needed. Existing "Owners and employees manage folders" and
-- "Investors can view folders of visible deals" policies (from
-- 002_terminal_rls.sql) already cover the new columns because they grant
-- row-level access, not column-level. Same for terminal_dd_documents.
