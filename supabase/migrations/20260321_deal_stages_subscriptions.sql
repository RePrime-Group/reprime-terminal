-- Add pre-pipeline columns to terminal_deals
ALTER TABLE terminal_deals
  ADD COLUMN IF NOT EXISTS psa_draft_start timestamptz,
  ADD COLUMN IF NOT EXISTS loi_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS teaser_description text;

-- Deal subscriptions (investors subscribing to Coming Soon deals)
CREATE TABLE IF NOT EXISTS terminal_deal_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES terminal_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  UNIQUE(deal_id, user_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS terminal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES terminal_users(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES terminal_deals(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_subscriptions_deal ON terminal_deal_subscriptions(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_subscriptions_user ON terminal_deal_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON terminal_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON terminal_notifications(user_id) WHERE read_at IS NULL;

-- RLS policies for subscriptions
ALTER TABLE terminal_deal_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Investors can manage their own subscriptions"
  ON terminal_deal_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all subscriptions"
  ON terminal_deal_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM terminal_users
      WHERE id = auth.uid() AND role IN ('owner', 'employee')
    )
  );

-- RLS policies for notifications
ALTER TABLE terminal_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON terminal_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON terminal_notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert notifications"
  ON terminal_notifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM terminal_users
      WHERE id = auth.uid() AND role IN ('owner', 'employee')
    )
  );
