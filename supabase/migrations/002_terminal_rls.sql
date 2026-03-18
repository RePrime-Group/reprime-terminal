-- Enable Row Level Security on all terminal tables
ALTER TABLE terminal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_deal_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_dd_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_dd_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION terminal_user_role()
RETURNS text AS $$
  SELECT role FROM terminal_users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- terminal_users policies
CREATE POLICY "Users can read own row" ON terminal_users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Owners can read all users" ON terminal_users
  FOR SELECT USING (terminal_user_role() = 'owner');
CREATE POLICY "Owners can insert users" ON terminal_users
  FOR INSERT WITH CHECK (terminal_user_role() = 'owner' OR id = auth.uid());
CREATE POLICY "Owners can update all users" ON terminal_users
  FOR UPDATE USING (terminal_user_role() = 'owner');
CREATE POLICY "Users can update own row" ON terminal_users
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Employees can read investor rows" ON terminal_users
  FOR SELECT USING (terminal_user_role() = 'employee');

-- terminal_invite_tokens policies
CREATE POLICY "Owners can manage invites" ON terminal_invite_tokens
  FOR ALL USING (terminal_user_role() = 'owner');
CREATE POLICY "Public can validate token" ON terminal_invite_tokens
  FOR SELECT USING (true);

-- terminal_deals policies
CREATE POLICY "Owners and employees can manage deals" ON terminal_deals
  FOR ALL USING (terminal_user_role() IN ('owner', 'employee'));
CREATE POLICY "Investors can view published/assigned/closed deals" ON terminal_deals
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND status IN ('published', 'assigned', 'closed')
  );

-- terminal_deal_photos policies
CREATE POLICY "Owners and employees manage photos" ON terminal_deal_photos
  FOR ALL USING (terminal_user_role() IN ('owner', 'employee'));
CREATE POLICY "Investors can view photos of visible deals" ON terminal_deal_photos
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM terminal_deals WHERE status IN ('published', 'assigned', 'closed')
    )
  );

-- terminal_dd_folders policies
CREATE POLICY "Owners and employees manage folders" ON terminal_dd_folders
  FOR ALL USING (terminal_user_role() IN ('owner', 'employee'));
CREATE POLICY "Investors can view folders of visible deals" ON terminal_dd_folders
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM terminal_deals WHERE status IN ('published', 'assigned', 'closed')
    )
  );

-- terminal_dd_documents policies
CREATE POLICY "Owners and employees manage documents" ON terminal_dd_documents
  FOR ALL USING (terminal_user_role() IN ('owner', 'employee'));
CREATE POLICY "Investors can view documents of visible deals" ON terminal_dd_documents
  FOR SELECT USING (
    terminal_user_role() = 'investor'
    AND deal_id IN (
      SELECT id FROM terminal_deals WHERE status IN ('published', 'assigned', 'closed')
    )
  );

-- terminal_activity_log policies
CREATE POLICY "Users can insert own activity" ON terminal_activity_log
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can view all activity" ON terminal_activity_log
  FOR SELECT USING (terminal_user_role() = 'owner');

-- terminal_meetings policies
CREATE POLICY "Investors can manage own meetings" ON terminal_meetings
  FOR ALL USING (investor_id = auth.uid());
CREATE POLICY "Owners can view all meetings" ON terminal_meetings
  FOR SELECT USING (terminal_user_role() = 'owner');

-- terminal_availability_slots policies
CREATE POLICY "Owners can manage availability" ON terminal_availability_slots
  FOR ALL USING (terminal_user_role() = 'owner');
CREATE POLICY "Everyone can read active slots" ON terminal_availability_slots
  FOR SELECT USING (is_active = true);

-- terminal_settings policies
CREATE POLICY "Owners can manage settings" ON terminal_settings
  FOR ALL USING (terminal_user_role() = 'owner');
CREATE POLICY "Everyone can read settings" ON terminal_settings
  FOR SELECT USING (true);
