-- Extend the default invite expiry on terminal_invite_tokens from 7 days to 30 days.
-- The original default was set in 001_terminal_tables.sql.
-- Existing pending invites are not back-filled — only new rows get the new default.

ALTER TABLE terminal_invite_tokens
  ALTER COLUMN expires_at SET DEFAULT now() + interval '30 days';
