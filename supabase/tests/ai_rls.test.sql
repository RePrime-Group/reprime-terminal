-- ============================================================================
-- RLS tests for terminal_ai_* tables
-- Run in Supabase SQL Editor (executes as postgres superuser).
--
-- Strategy:
--   1. Seed fixtures as superuser (bypasses RLS — intentional for setup).
--   2. EXECUTE 'SET LOCAL ROLE authenticated' to subject subsequent queries
--      to RLS, then set JWT claims to impersonate each test user.
--   3. EXECUTE 'SET LOCAL ROLE postgres' before cleanup.
-- ============================================================================

do $$
declare
  v_owner_id   uuid := gen_random_uuid();
  v_investor_a uuid := gen_random_uuid();
  v_investor_b uuid := gen_random_uuid();
  v_deal_id    uuid := gen_random_uuid();
  v_conv_a     uuid := gen_random_uuid();
  v_cnt        int;
begin
  -- ── Seed as superuser ─────────────────────────────────────────────────────
  insert into auth.users
    (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, aud, role)
  values
    (v_owner_id,   'owner_test@reprime.test',     '', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (v_investor_a, 'investor_a_test@reprime.test', '', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
    (v_investor_b, 'investor_b_test@reprime.test', '', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated');

  insert into terminal_users (id, email, full_name, role) values
    (v_owner_id,   'owner_test@reprime.test',     'Test Owner',      'owner'),
    (v_investor_a, 'investor_a_test@reprime.test', 'Test Investor A', 'investor'),
    (v_investor_b, 'investor_b_test@reprime.test', 'Test Investor B', 'investor');

  insert into terminal_deals (id, name, city, state, property_type, purchase_price, status)
  values (v_deal_id, 'Test Deal RLS', 'Test City', 'TX', 'industrial', '1000000', 'published');

  insert into terminal_ai_conversations (id, user_id, deal_id, title)
  values (v_conv_a, v_investor_a, v_deal_id, 'Investor A thread');

  -- Message-level RLS tests removed in 20260519_drop_terminal_ai_messages.sql.
  -- Chat messages now live in n8n_chat_histories, scoped via the conversation's
  -- session_id and accessed only through the service-role admin client in
  -- src/app/api/ai/conversations/[id]/route.ts.

  -- ── Switch to authenticated role so RLS is enforced ───────────────────────
  execute 'set local role authenticated';

  -- ── Test 1: Investor B cannot see Investor A's conversation ───────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_investor_b::text)::text, true);
  select count(*) into v_cnt from terminal_ai_conversations where id = v_conv_a;
  assert v_cnt = 0,
    'FAIL: investor B must not see investor A conversation';

  -- ── Test 2: Investor A can see their own conversation ─────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_investor_a::text)::text, true);
  select count(*) into v_cnt from terminal_ai_conversations where id = v_conv_a;
  assert v_cnt = 1,
    'FAIL: investor A must see their own conversation';

  -- ── Test 3: Anon SELECT on every terminal_ai_* table returns 0 rows ───────
  execute 'set local role anon';
  perform set_config('request.jwt.claims', '{}', true);

  select count(*) into v_cnt from terminal_ai_conversations;
  assert v_cnt = 0, 'FAIL: anon must not see any conversations';

  select count(*) into v_cnt from terminal_ai_feedback;
  assert v_cnt = 0, 'FAIL: anon must not see any feedback';

  select count(*) into v_cnt from terminal_ai_audit;
  assert v_cnt = 0, 'FAIL: anon must not see any audit rows';

  -- ── Test 4: Owner can read all conversations ──────────────────────────────
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_id::text)::text, true);
  select count(*) into v_cnt from terminal_ai_conversations where deal_id = v_deal_id;
  assert v_cnt = 1,
    'FAIL: owner must see all conversations';

  -- ── Test 5: Investor cannot read audit table ──────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', v_investor_a::text)::text, true);
  select count(*) into v_cnt from terminal_ai_audit;
  assert v_cnt = 0,
    'FAIL: investor must not see any audit rows';

  raise notice 'All ai_rls tests passed.';

  -- ── Switch back to superuser for cleanup ──────────────────────────────────
  execute 'set local role postgres';
  delete from terminal_ai_conversations where id = v_conv_a;
  delete from terminal_deals  where id = v_deal_id;
  delete from terminal_users  where id in (v_owner_id, v_investor_a, v_investor_b);
  delete from auth.users      where id in (v_owner_id, v_investor_a, v_investor_b);

exception when others then
  execute 'set local role postgres';
  delete from terminal_ai_conversations where id = v_conv_a;
  delete from terminal_deals  where id = v_deal_id;
  delete from terminal_users  where id in (v_owner_id, v_investor_a, v_investor_b);
  delete from auth.users      where id in (v_owner_id, v_investor_a, v_investor_b);
  raise;
end;
$$;
