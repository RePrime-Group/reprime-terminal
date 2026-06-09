-- investor_group_tabs_rls_test.sql
-- Manual RLS proof for the Investor Group Tabs migration (20260609).
-- NOT a migration — lives outside supabase/migrations/ so it never auto-runs.
--
-- HOW TO USE
--   1. Run this in the Supabase SQL editor (or psql) as the service role / owner.
--   2. Fill the four ids in the SETUP block below with real terminal_users.id
--      and a real terminal_deals.id whose status is NOT public to an investor
--      (e.g. 'coming_soon' or 'draft') — that is the off-market case.
--   3. Run section by section. Each SELECT comment says what you SHOULD see.
--
-- HOW IMPERSONATION WORKS
--   set local role authenticated;  -- drop superuser so RLS actually applies
--   select set_config('request.jwt.claims', ...);  -- auth.uid() reads 'sub'
--   RESET ROLE; back to admin between users.

-- ===========================================================================
-- SETUP  (run as service role / owner — RLS is bypassed here on purpose)
-- ===========================================================================
-- Replace these with real ids before running.
--   :member_a   -- an investor who WILL be in the group
--   :member_b   -- a second investor who WILL be in the group
--   :nonmember  -- an investor who will NOT be in the group
--   :offdeal    -- a terminal_deals.id with a non-public status (coming_soon/draft)

-- Create the group "RePrime QA".
INSERT INTO public.terminal_investor_tabs (id, name, is_enabled)
VALUES ('00000000-0000-0000-0000-0000000000aa', 'RePrime QA', true)
ON CONFLICT (id) DO UPDATE SET is_enabled = true;

-- Add member_a and member_b to the group.
INSERT INTO public.terminal_investor_tab_members (tab_id, user_id)
VALUES
  ('00000000-0000-0000-0000-0000000000aa', :'member_a'),
  ('00000000-0000-0000-0000-0000000000aa', :'member_b')
ON CONFLICT (tab_id, user_id) DO NOTHING;

-- Assign the off-market deal to the group (active).
INSERT INTO public.terminal_deal_tab_assignments (deal_id, tab_id, status)
VALUES (:'offdeal', '00000000-0000-0000-0000-0000000000aa', 'active')
ON CONFLICT (deal_id, tab_id) DO UPDATE SET status = 'active';


-- ===========================================================================
-- TEST 1 — member_a sees the group; nonmember does NOT
-- (RLS on terminal_investor_tabs)
-- ===========================================================================
SET local role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'member_a', 'role', 'authenticated')::text, true);
-- EXPECT: 1 row ("RePrime QA").
SELECT id, name FROM public.terminal_investor_tabs;
RESET ROLE;

SET local role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'nonmember', 'role', 'authenticated')::text, true);
-- EXPECT: 0 rows.
SELECT id, name FROM public.terminal_investor_tabs;
RESET ROLE;


-- ===========================================================================
-- TEST 2 — member_a CANNOT enumerate co-members
-- (membership select scoped to user_id = auth.uid())
-- ===========================================================================
SET local role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'member_a', 'role', 'authenticated')::text, true);
-- EXPECT: 1 row — only member_a's own membership row (NOT member_b's).
SELECT user_id FROM public.terminal_investor_tab_members;
RESET ROLE;


-- ===========================================================================
-- TEST 3 — member CANNOT read assignment rows for a group they are not in
-- (RLS on terminal_deal_tab_assignments)
-- ===========================================================================
SET local role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'nonmember', 'role', 'authenticated')::text, true);
-- EXPECT: 0 rows.
SELECT deal_id, tab_id FROM public.terminal_deal_tab_assignments;
RESET ROLE;


-- ===========================================================================
-- TEST 4 — off-market deal is readable by a member, NOT by a non-member
-- (the additive "member reads curated deals" policy on terminal_deals)
-- ===========================================================================
SET local role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'member_a', 'role', 'authenticated')::text, true);
-- EXPECT: 1 row (the off-market deal is visible through the group).
SELECT id, status FROM public.terminal_deals WHERE id = :'offdeal';
RESET ROLE;

SET local role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'nonmember', 'role', 'authenticated')::text, true);
-- EXPECT: 0 rows (non-member cannot see the off-market deal anywhere).
SELECT id, status FROM public.terminal_deals WHERE id = :'offdeal';
RESET ROLE;


-- ===========================================================================
-- TEST 5 — disabling the group immediately revokes visibility
-- ===========================================================================
-- Disable the group (as admin).
UPDATE public.terminal_investor_tabs
  SET is_enabled = false
  WHERE id = '00000000-0000-0000-0000-0000000000aa';

SET local role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'member_a', 'role', 'authenticated')::text, true);
-- EXPECT: 0 rows — the group is hidden now.
SELECT id, name FROM public.terminal_investor_tabs;
-- EXPECT: 0 rows — the off-market deal is no longer visible to the member.
SELECT id, status FROM public.terminal_deals WHERE id = :'offdeal';
RESET ROLE;

-- Re-enable for any further manual checks.
UPDATE public.terminal_investor_tabs
  SET is_enabled = true
  WHERE id = '00000000-0000-0000-0000-0000000000aa';


-- ===========================================================================
-- TEST 6 — removing a member revokes their tab + off-market access
-- ===========================================================================
DELETE FROM public.terminal_investor_tab_members
  WHERE tab_id = '00000000-0000-0000-0000-0000000000aa'
    AND user_id = :'member_b';

SET local role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'member_b', 'role', 'authenticated')::text, true);
-- EXPECT: 0 rows (group gone for member_b).
SELECT id, name FROM public.terminal_investor_tabs;
-- EXPECT: 0 rows (off-market deal gone for member_b).
SELECT id, status FROM public.terminal_deals WHERE id = :'offdeal';
RESET ROLE;


-- ===========================================================================
-- TEST 7 — removing the deal->group assignment revokes the otherwise-hidden deal
-- ===========================================================================
DELETE FROM public.terminal_deal_tab_assignments
  WHERE tab_id = '00000000-0000-0000-0000-0000000000aa'
    AND deal_id = :'offdeal';

SET local role authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', :'member_a', 'role', 'authenticated')::text, true);
-- EXPECT: 0 rows (assignment removed -> deal hidden again for member_a).
SELECT id, status FROM public.terminal_deals WHERE id = :'offdeal';
RESET ROLE;


-- ===========================================================================
-- CLEANUP (optional) — remove all QA test data
-- ===========================================================================
-- DELETE FROM public.terminal_investor_tabs
--   WHERE id = '00000000-0000-0000-0000-0000000000aa';
--   (cascades members + assignments)
