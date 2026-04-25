-- ─────────────────────────────────────────────────────────────────────────────
-- Nightly cleanup: purge any temp uploads from the rent-roll "Extract from
-- File" flow that survived past 24h.
--
-- Normal flow: the API route deletes the temp object in a finally block, so
-- this sweep should almost never have anything to do. It exists to catch the
-- abort case (browser closes between the storage upload and the API call).
--
-- Path convention: _temp/extract-tenants/{dealId}/{timestamp}-{filename}
-- Bucket: terminal-dd-documents
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron with schema extensions;

-- pg_cron lives in the extensions schema on Supabase. The job runs as the
-- postgres role, which can write to storage.objects.
select cron.schedule(
  'purge-temp-extract-uploads',
  '15 3 * * *', -- 03:15 UTC daily
  $$
    delete from storage.objects
     where bucket_id = 'terminal-dd-documents'
       and name like '\_temp/extract-tenants/%' escape '\'
       and created_at < now() - interval '24 hours';
  $$
);
