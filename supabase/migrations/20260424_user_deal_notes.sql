-- Per-property investor notepad. Notes are strictly private to the note owner.
-- No owner/employee read policy by design — admins must not see investor notes.

CREATE TABLE IF NOT EXISTS user_deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_user_deal_notes_user ON user_deal_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_deal_notes_deal ON user_deal_notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_user_deal_notes_lookup ON user_deal_notes(user_id, deal_id);

ALTER TABLE user_deal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select_own" ON user_deal_notes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notes_insert_own" ON user_deal_notes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "notes_update_own" ON user_deal_notes
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "notes_delete_own" ON user_deal_notes
  FOR DELETE USING (user_id = auth.uid());
