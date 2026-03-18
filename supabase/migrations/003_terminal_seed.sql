-- RePrime Terminal Seed Data
-- IMPORTANT: Before running this migration, create auth accounts for the owners
-- in Supabase Dashboard -> Authentication -> Users -> Add User.
-- Then replace the UUIDs below with the actual auth.users IDs from the dashboard.

INSERT INTO terminal_users (id, email, full_name, role, language_preference)
VALUES
  ('REPLACE_WITH_GIDEON_AUTH_UUID', 'gideon@reprimegroup.com', 'Gideon Gratsiani', 'owner', 'en'),
  ('REPLACE_WITH_SHIREL_AUTH_UUID', 'shirel@reprimegroup.com', 'Shirel Ben-Haroush', 'owner', 'en')
ON CONFLICT (id) DO NOTHING;

-- Seed default settings
INSERT INTO terminal_settings (key, value) VALUES
  ('contact_name', '"Shirel Gratsiani"'),
  ('contact_title', '"VP, Investor Relations"'),
  ('contact_email', '"shirel@reprimegroup.com"'),
  ('meeting_duration_minutes', '30'),
  ('meeting_buffer_minutes', '15')
ON CONFLICT (key) DO NOTHING;

-- Seed default availability (Mon-Fri, 9AM-5PM EST)
INSERT INTO terminal_availability_slots (day_of_week, start_time, end_time, timezone) VALUES
  (1, '09:00', '17:00', 'America/New_York'),
  (2, '09:00', '17:00', 'America/New_York'),
  (3, '09:00', '17:00', 'America/New_York'),
  (4, '09:00', '17:00', 'America/New_York'),
  (5, '09:00', '17:00', 'America/New_York')
ON CONFLICT DO NOTHING;
