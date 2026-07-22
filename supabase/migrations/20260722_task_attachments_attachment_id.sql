-- Link task attachments to the single source of truth for files.
-- terminal_task_attachments gets an attachment_id FK -> terminal_dd_documents(id)
-- so the file itself lives only in terminal_dd_documents. storage_path becomes
-- nullable so new task attachments needn't duplicate the pointer; the legacy
-- column is dropped later once existing files are migrated.
--
-- Backfill: attachments that were shared with investors already have a mirror
-- row in terminal_dd_documents keyed by (deal_id, storage_path) (see the
-- toggleTransparency flow in PipelineView.tsx). Point attachment_id at it.
--
-- ROLLBACK:
--   alter table terminal_task_attachments alter column storage_path set not null;
--   alter table terminal_task_attachments drop column if exists attachment_id;

alter table public.terminal_task_attachments
  add column if not exists attachment_id uuid;

alter table public.terminal_task_attachments
  drop constraint if exists terminal_task_attachments_attachment_id_fkey;

alter table public.terminal_task_attachments
  add constraint terminal_task_attachments_attachment_id_fkey
  foreign key (attachment_id) references public.terminal_dd_documents(id)
  on delete set null;

alter table public.terminal_task_attachments
  alter column storage_path drop not null;

-- Backfill: every existing task attachment becomes a terminal_dd_documents row
-- (the single source of truth). Attachments that were shared with investors
-- already have a mirror row (created by the old toggleTransparency flow, keyed
-- by storage_path) — skip those; the update below links them. Unshared ones get
-- a fresh row here. One row per distinct (deal_id, storage_path); folder_id null
-- (not in the data-room tree); name uses the attachment id so it can't collide
-- with the (deal_id, name) unique index; sha256 left NULL for the later
-- file-migration script. indexing_status 'pending' — these become RAG-indexed
-- and answerable by the deal AI (accepted trade-off).
-- NOTE: folder placement for shared attachments is corrected in a follow-up
-- migration (20260722_task_attachments_folder_backfill.sql).
insert into terminal_dd_documents (
  deal_id, folder_id, storage_path, name, display_name,
  file_size, file_type, uploaded_by, indexing_status, created_at
)
select distinct on (a.deal_id, a.storage_path)
  a.deal_id,
  null::uuid,
  a.storage_path,
  'task-attachment-' || a.id::text,
  a.name,
  a.file_size,
  a.file_type,
  a.uploaded_by,
  'pending',
  now()
from terminal_task_attachments a
where a.storage_path is not null
  and not exists (
    select 1 from terminal_dd_documents d
    where d.deal_id = a.deal_id and d.storage_path = a.storage_path
  )
order by a.deal_id, a.storage_path, a.created_at;

-- Link every attachment (including duplicates that collapsed onto one row above)
-- to its mirror document row.
update terminal_task_attachments a
   set attachment_id = d.id
  from terminal_dd_documents d
 where a.attachment_id is null
   and a.storage_path is not null
   and d.deal_id = a.deal_id
   and d.storage_path = a.storage_path;
