-- ============================================================================
-- terminal_dd_documents.folder_id: relax NOT NULL
-- ============================================================================
-- Phase 6 Step 7 follow-up. Dataroom docs always belong to a folder, but the
-- new deal-level slot rows (source_kind in deal_om, deal_loi, deal_psa, ...)
-- do not — they mirror columns on terminal_deals, not a folder. Allow null.
--
-- ROLLBACK:
--   alter table terminal_dd_documents alter column folder_id set not null;
--   -- only safe if you first DELETE every row with folder_id is null,
--   -- i.e. every deal-level row.

alter table terminal_dd_documents
  alter column folder_id drop not null;
