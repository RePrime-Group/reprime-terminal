-- Deal pipeline stages
CREATE TABLE IF NOT EXISTS terminal_deal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('post_loi', 'due_diligence', 'pre_closing', 'post_closing')),
  started_at timestamptz,
  completed_at timestamptz,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Deal tasks within each stage
CREATE TABLE IF NOT EXISTS terminal_deal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('post_loi', 'due_diligence', 'pre_closing', 'post_closing')),
  name text NOT NULL,
  assignee_id uuid REFERENCES terminal_users(id),
  due_days integer,
  due_date timestamptz,
  due_type text DEFAULT 'after_stage' CHECK (due_type IN ('after_stage', 'on_stage', 'after_listing_executed')),
  is_gate boolean DEFAULT false,
  is_milestone boolean DEFAULT false,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue', 'blocked')),
  completed_at timestamptz,
  completed_by uuid REFERENCES terminal_users(id),
  sort_order integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Task attachments (documents uploaded through tasks)
CREATE TABLE IF NOT EXISTS terminal_task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES terminal_deal_tasks(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_size text,
  file_type text,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES terminal_users(id),
  show_to_investors boolean DEFAULT false,
  investor_folder_id uuid REFERENCES terminal_dd_folders(id),
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Internal messages per deal
CREATE TABLE IF NOT EXISTS terminal_deal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES terminal_users(id),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE terminal_deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_deal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_deal_messages ENABLE ROW LEVEL SECURITY;

-- Staff can manage all pipeline tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_manage_stages') THEN
    CREATE POLICY "staff_manage_stages" ON terminal_deal_stages
      FOR ALL USING (
        EXISTS (SELECT 1 FROM terminal_users WHERE id = auth.uid() AND role IN ('owner', 'employee'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_manage_tasks') THEN
    CREATE POLICY "staff_manage_tasks" ON terminal_deal_tasks
      FOR ALL USING (
        EXISTS (SELECT 1 FROM terminal_users WHERE id = auth.uid() AND role IN ('owner', 'employee'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_manage_task_attachments') THEN
    CREATE POLICY "staff_manage_task_attachments" ON terminal_task_attachments
      FOR ALL USING (
        EXISTS (SELECT 1 FROM terminal_users WHERE id = auth.uid() AND role IN ('owner', 'employee'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'investors_view_shared_attachments') THEN
    CREATE POLICY "investors_view_shared_attachments" ON terminal_task_attachments
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM terminal_users WHERE id = auth.uid() AND role = 'investor')
        AND show_to_investors = true
        AND deal_id IN (SELECT id FROM terminal_deals WHERE status IN ('published', 'assigned', 'closed'))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_manage_messages') THEN
    CREATE POLICY "staff_manage_messages" ON terminal_deal_messages
      FOR ALL USING (
        EXISTS (SELECT 1 FROM terminal_users WHERE id = auth.uid() AND role IN ('owner', 'employee'))
      );
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_stages_deal_id ON terminal_deal_stages(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal_id ON terminal_deal_tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_stage ON terminal_deal_tasks(deal_id, stage);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON terminal_task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_deal_id ON terminal_task_attachments(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_messages_deal_id ON terminal_deal_messages(deal_id);
