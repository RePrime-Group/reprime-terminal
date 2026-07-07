-- 20260707_google_drive_integration.sql
-- Google Drive integration — data model + RLS.
--
-- Two tables:
--   1. terminal_google_drive_connection — the SINGLE org-wide Google account the
--      workspace has connected (OAuth refresh token + short-lived access token).
--      One row only (enforced by the boolean singleton PK).
--   2. terminal_deal_drive_folders — the ONE Drive folder connected to a deal
--      (deal_id UNIQUE). An n8n workflow watches this folder; the app only
--      records the mapping.
--
-- Token secrecy: the connection row holds a refresh_token and must never be
-- readable by clients. RLS is enabled with NO permissive policy, so every role
-- is denied by default; the app reads/writes it exclusively through the
-- service-role client (createAdminClient, which bypasses RLS) inside server
-- code. This mirrors how the activity_webhook_* secret is kept server-only.
--
-- The folder-mapping table holds no secrets (just a folder id + name), so it
-- gets the standard "staff FOR ALL" policy used across the schema
-- (002_terminal_rls.sql / 20260609_investor_group_tabs.sql), gated by
-- terminal_user_role().

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. terminal_google_drive_connection — single org-wide connected account.
--    The `id boolean DEFAULT true CHECK (id)` PK guarantees at most one row:
--    the app upserts ON CONFLICT (id). Disconnect = DELETE the row.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminal_google_drive_connection (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id),      -- singleton guard
  google_email  text NOT NULL,                                    -- connected account, shown in Settings
  refresh_token text NOT NULL,                                    -- long-lived; server-only
  access_token  text,                                             -- short-lived cache
  token_expiry  timestamptz,                                      -- access_token expiry
  scope         text,                                             -- granted OAuth scope(s)
  connected_by  uuid REFERENCES public.terminal_users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.terminal_google_drive_connection ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: RLS-enabled + zero permissive policies = deny-all for
-- every non-service-role. The refresh_token stays server-only. All access goes
-- through the service-role client in server actions / API routes.

-- ---------------------------------------------------------------------------
-- 2. terminal_deal_drive_folders — one connected Drive folder per deal.
--    deal_id UNIQUE enforces the "one folder per deal" rule; connect = upsert
--    ON CONFLICT (deal_id), disconnect = DELETE.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminal_deal_drive_folders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           uuid NOT NULL UNIQUE REFERENCES public.terminal_deals(id) ON DELETE CASCADE,
  drive_folder_id   text NOT NULL,                                -- Google Drive folder id (n8n watches this)
  drive_folder_name text NOT NULL,                                -- display label
  connected_by      uuid REFERENCES public.terminal_users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terminal_deal_drive_folders_deal
  ON public.terminal_deal_drive_folders (deal_id);

ALTER TABLE public.terminal_deal_drive_folders ENABLE ROW LEVEL SECURITY;

-- Staff (owner/employee) full control; investors have no access.
DROP POLICY IF EXISTS "staff manage deal drive folders" ON public.terminal_deal_drive_folders;
CREATE POLICY "staff manage deal drive folders" ON public.terminal_deal_drive_folders
  FOR ALL USING (terminal_user_role() IN ('owner', 'employee'))
  WITH CHECK (terminal_user_role() IN ('owner', 'employee'));

COMMIT;
