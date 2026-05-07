#!/usr/bin/env node
/**
 * Verify deal-assistant-chat conversation routing after the Has-Conversation-ID? refactor.
 *
 * Cases:
 *   1. No conversation_id           -> server creates a NEW conversation (returns id A)
 *   2. conversation_id = A          -> server reuses conversation A (returns id A)
 *   3. conversation_id = <bogus>    -> server returns 404
 *   4. No conversation_id (again)   -> server creates ANOTHER NEW conversation (returns id B != A)
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const N8N_BASE     = process.env.N8N_BASE_URL;
const N8N_PATH     = process.env.N8N_WEBHOOK_PATH_CHAT;

if (!SUPABASE_URL || !SERVICE_KEY || !N8N_BASE || !N8N_PATH) {
  console.error('Missing env. Run: node --env-file=.env.local scripts/test-conversation-routing.mjs');
  process.exit(1);
}

const DEAL_ID = '00173b9d-14af-42e9-ab4d-91f59b16c5cc';
const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', dim: '\x1b[2m', bold: '\x1b[1m' };

const sb = (path) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
}).then((r) => r.json());

async function chat(userId, message, conversationId) {
  const body = { user_id: userId, deal_id: DEAL_ID, message };
  if (conversationId !== undefined) body.conversation_id = conversationId;
  const r = await fetch(`${N8N_BASE}${N8N_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

function check(name, cond, detail = '') {
  const tag = cond ? `${C.green}✓ PASS${C.reset}` : `${C.red}✗ FAIL${C.reset}`;
  console.log(`${tag} ${name}${detail ? `  ${C.dim}(${detail})${C.reset}` : ''}`);
  return cond;
}

async function main() {
  const audit = await sb(`terminal_ai_audit?select=user_id&deal_id=eq.${DEAL_ID}&order=created_at.desc&limit=1`);
  const userId = audit[0]?.user_id;
  if (!userId) { console.error('No user has chatted on this deal yet.'); process.exit(1); }

  console.log(`${C.bold}Conversation routing test${C.reset}`);
  console.log(`${C.dim}user:${C.reset} ${userId}  ${C.dim}deal:${C.reset} ${DEAL_ID}\n`);

  let pass = true;

  // Case 1: no conversation_id -> create new (A)
  process.stdout.write('1. POST without conversation_id ... ');
  const r1 = await chat(userId, 'Hi, this is the first turn.');
  const idA = r1.json.conversation_id;
  console.log(`got ${idA}`);
  pass &= check('  returns 200 + new conversation_id', r1.status === 200 && !!idA);

  // Case 2: same id -> reuses (returns same A)
  process.stdout.write(`2. POST with conversation_id=A (${idA?.slice(0, 8)}) ... `);
  const r2 = await chat(userId, 'Second turn, same thread.', idA);
  console.log(`got ${r2.json.conversation_id}`);
  pass &= check('  reuses conversation A', r2.status === 200 && r2.json.conversation_id === idA);

  // Case 3: bogus id -> 404
  const bogus = '00000000-0000-0000-0000-000000000000';
  process.stdout.write(`3. POST with bogus conversation_id ... `);
  const r3 = await chat(userId, 'Should not be processed.', bogus);
  console.log(`status ${r3.status}`);
  pass &= check('  returns 404', r3.status === 404, `body: ${JSON.stringify(r3.json).slice(0, 100)}`);

  // Case 4: no conversation_id again -> new (B != A)
  process.stdout.write('4. POST without conversation_id again ... ');
  const r4 = await chat(userId, 'Brand new thread, please.');
  const idB = r4.json.conversation_id;
  console.log(`got ${idB}`);
  pass &= check('  returns 200 + DIFFERENT conversation_id', r4.status === 200 && !!idB && idB !== idA);

  console.log();
  console.log(pass ? `${C.green}${C.bold}ALL CHECKS PASSED${C.reset}` : `${C.red}${C.bold}FAILURES ABOVE${C.reset}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
