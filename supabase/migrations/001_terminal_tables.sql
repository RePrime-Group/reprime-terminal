-- RePrime Terminal Database Schema
-- All tables prefixed with terminal_ to coexist with existing Supabase tables

CREATE TABLE terminal_users (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'employee', 'investor')),
  language_preference text DEFAULT 'en' CHECK (language_preference IN ('en', 'he')),
  company_name text,
  phone text,
  is_active boolean DEFAULT true,
  last_active_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE terminal_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text DEFAULT 'investor' CHECK (role IN ('investor', 'employee')),
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  invited_by uuid REFERENCES terminal_users(id),
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT now() + interval '7 days',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE terminal_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  property_type text NOT NULL,
  square_footage text,
  units text,
  class_type text,
  year_built integer,
  occupancy text,
  purchase_price text NOT NULL,
  noi text,
  cap_rate text,
  irr text,
  coc text,
  dscr text,
  equity_required text,
  loan_estimate text,
  seller_financing boolean DEFAULT false,
  special_terms text DEFAULT 'None',
  assignment_fee text DEFAULT '3%',
  assignment_irr text,
  gplp_irr text,
  acq_fee text DEFAULT '1%',
  asset_mgmt_fee text DEFAULT '2%',
  gp_carry text DEFAULT '20% above 8% pref',
  loan_fee text DEFAULT '1 point',
  dd_deadline timestamptz,
  close_deadline timestamptz,
  extension_deadline timestamptz,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'under_review', 'assigned', 'closed')),
  neighborhood text,
  metro_population text,
  job_growth text,
  investment_highlights text[],
  acquisition_thesis text,
  quarter_release text,
  created_by uuid REFERENCES terminal_users(id),
  assigned_to uuid REFERENCES terminal_users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE terminal_deal_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  display_order integer DEFAULT 0,
  caption text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE terminal_dd_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text,
  display_order integer DEFAULT 0
);

CREATE TABLE terminal_dd_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES terminal_dd_folders(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES terminal_deals(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_size text,
  file_type text,
  storage_path text,
  is_verified boolean DEFAULT false,
  uploaded_by uuid REFERENCES terminal_users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE terminal_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES terminal_users(id),
  deal_id uuid REFERENCES terminal_deals(id),
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE terminal_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES terminal_deals(id),
  investor_id uuid NOT NULL REFERENCES terminal_users(id),
  scheduled_at timestamptz NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE terminal_availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text DEFAULT 'America/New_York',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE terminal_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
