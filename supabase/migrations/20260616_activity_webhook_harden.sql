-- ─────────────────────────────────────────────────────────────────────────────
-- Harden the activity webhook so it can NEVER break activity logging.
--
-- Root cause of the 42883 (undefined_function) errors on POST
-- /rest/v1/terminal_activity_log:
--   The original migration installed pg_net with `WITH SCHEMA extensions`. pg_net
--   is relocatable, so its functions live in extensions.http_post, but the trigger
--   called net.http_post (schema-qualified) — which does not resolve. Because the
--   trigger is a synchronous AFTER INSERT, that exception aborted the whole INSERT
--   and the activity row was never written.
--
-- Two fixes:
--   1. Call http_post UNQUALIFIED with a search_path that covers both possible
--      schemas (net and extensions), so it resolves wherever pg_net actually is.
--   2. Wrap the POST in an exception block — any webhook failure (undefined fn,
--      network, bad URL) is swallowed so the INSERT always succeeds.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_net;

create or replace function terminal_activity_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
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

  -- A webhook failure must never break activity logging. http_post is called
  -- unqualified so it resolves whether pg_net lives in net.* or extensions.*.
  begin
    perform http_post(
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
  exception when others then
    raise warning 'terminal_activity_webhook: POST failed (%): %', sqlstate, sqlerrm;
  end;

  return new;
end;
$$;
