-- ─────────────────────────────────────────────────────────────────────────────
-- Activity webhook: forward investor activity to a configurable URL.
--
-- When a row is inserted into terminal_activity_log by an investor-role user,
-- an AFTER INSERT trigger async-POSTs the row to a webhook URL stored in
-- terminal_settings (key: activity_webhook_url). A shared secret
-- (activity_webhook_secret) is sent as the x-webhook-secret header.
--
-- The trigger is the single chokepoint for every insert source — the client
-- useActivityTracker hook and all API routes — so no app code changes are
-- needed. pg_net is fire-and-forget: a slow or down receiver never blocks or
-- fails the investor's action.
--
-- Disabled by default: forwarding is skipped while activity_webhook_url is ''.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_net with schema extensions;

-- The secret must not be world-readable. The existing "Everyone can read
-- settings" policy exposes every row to any authenticated user, so replace it
-- with one that hides the activity_webhook_* keys from non-owners. The trigger
-- function below is SECURITY DEFINER and reads these keys regardless of RLS;
-- the app never reads them client-side, so nothing breaks.
drop policy if exists "Everyone can read settings" on terminal_settings;
create policy "Everyone can read settings" on terminal_settings
  for select using (
    key not like 'activity_webhook_%' or terminal_user_role() = 'owner'
  );

create or replace function terminal_activity_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_secret text;
  v_role   text;
begin
  -- Only forward investor-role users' activity.
  select role into v_role from terminal_users where id = new.user_id;
  if v_role is distinct from 'investor' then
    return new;
  end if;

  -- terminal_settings.value is text. Strip any surrounding quotes so the URL
  -- works whether stored plain (https://…) or JSON-quoted ("https://…").
  select value into v_url from terminal_settings where key = 'activity_webhook_url';
  v_url := nullif(btrim(coalesce(v_url, ''), '"'), '');
  if v_url is null then
    return new;
  end if;

  select value into v_secret from terminal_settings where key = 'activity_webhook_secret';
  v_secret := btrim(coalesce(v_secret, ''), '"');

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := jsonb_build_object(
      'id',         new.id,
      'user_id',    new.user_id,
      'deal_id',    new.deal_id,
      'action',     new.action,
      'metadata',   new.metadata,
      'created_at', new.created_at
    )
  );

  return new;
end;
$$;

drop trigger if exists terminal_activity_log_webhook on terminal_activity_log;
create trigger terminal_activity_log_webhook
  after insert on terminal_activity_log
  for each row
  execute function terminal_activity_webhook();
