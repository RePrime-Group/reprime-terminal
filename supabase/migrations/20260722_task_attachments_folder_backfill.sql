-- Follow-up to 20260722_task_attachments_attachment_id.sql.
--
-- That migration inserted task-attachment mirror rows with folder_id = NULL, so
-- attachments that were shown to investors did not appear in the investor data
-- room (the tree is driven by terminal_dd_documents.folder_id). Place each mirror
-- row in the attachment's investor_folder_id when it is shown to investors, else
-- leave it out of any folder.
--
-- Joins through attachment_id (already backfilled by the prior migration), so it
-- only touches task-attachment mirror rows — never data-room or deal-level slot
-- docs. Idempotent: the `is distinct from` guard skips rows already correct.
--
-- ROLLBACK: none needed — this only corrects folder placement.

update terminal_dd_documents d
   set folder_id = case when a.show_to_investors then a.investor_folder_id else null end
  from terminal_task_attachments a
 where a.attachment_id = d.id
   and d.folder_id is distinct from (case when a.show_to_investors then a.investor_folder_id else null end);
