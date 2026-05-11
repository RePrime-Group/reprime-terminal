#!/usr/bin/env node
/**
 * Deep debug of the deal-assistant-chat agent output.
 *
 * Triggers one chat turn through the live n8n webhook, then pulls the
 * complete execution record back from the n8n REST API. Walks every node's
 * input/output recursively and prints the full dot-path of every place a
 * token-usage object appears. The full execution is also dumped to a JSON
 * file so you can grep / inspect anything else.
 *
 * Usage:
 *   node --env-file=.env.local scripts/debug-ai-agent-output.mjs
 *
 * Requires (in .env.local):
 *   N8N_BASE_URL, N8N_API_KEY, N8N_WEBHOOK_PATH_CHAT,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * If you don't have N8N_API_KEY yet:
 *   n8n UI → Settings → n8n API → Create an API key →
 *   add to .env.local as N8N_API_KEY="<key>".
 */

import fs from 'node:fs';

const N8N_BASE      = process.env.N8N_BASE_URL;
const N8N_API_KEY   = process.env.N8N_API_KEY;
const N8N_PATH_CHAT = process.env.N8N_WEBHOOK_PATH_CHAT;
const SUPA_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WORKFLOW_ID = '6hz22YdBC500tHxg';
const NODES_OF_INTEREST = ['AI Agent', 'Capture Metrics', 'Claude Sonnet 4.6', 'Write Usage'];
const TOKEN_KEYS = [
  'input_tokens', 'output_tokens',
  'promptTokens', 'completionTokens',
  'inputTokens', 'outputTokens',
  'cache_creation_input_tokens', 'cache_read_input_tokens',
  'total_tokens', 'totalTokens',
];

const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m' };

function fail(msg) { console.error(`${C.red}✗ ${msg}${C.reset}`); process.exit(1); }
function bold(msg) { console.log(`\n${C.bold}${msg}${C.reset}`); }
function ok(msg)   { console.log(`${C.green}✓ ${C.reset}${msg}`); }
function warn(msg) { console.log(`${C.yellow}! ${C.reset}${msg}`); }
function dim(msg)  { console.log(`${C.dim}${msg}${C.reset}`); }

if (!N8N_BASE)      fail('Missing N8N_BASE_URL');
if (!N8N_API_KEY)   fail('Missing N8N_API_KEY (n8n Settings > n8n API > Create an API key)');
if (!N8N_PATH_CHAT) fail('Missing N8N_WEBHOOK_PATH_CHAT');
if (!SUPA_URL || !SUPA_KEY) fail('Missing Supabase env');

// ── helpers ────────────────────────────────────────────────────────────────

async function sb(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
  });
  return r.json();
}

async function pickInvestor() {
  const rows = await sb('terminal_users?select=id,full_name&role=eq.investor&limit=1');
  return rows[0];
}

async function pickDeal() {
  const rows = await sb('terminal_deals?select=id,name&status=in.(published,assigned,closed,coming_soon,loi_signed)&limit=1');
  return rows[0];
}

async function sendChat(user_id, deal_id, message = 'What is the cap rate?') {
  const t0 = Date.now();
  const r = await fetch(`${N8N_BASE}${N8N_PATH_CHAT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, deal_id, message }),
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, latencyMs: Date.now() - t0, data };
}

async function fetchLatestExecution() {
  const list = await fetch(`${N8N_BASE}/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=1&includeData=false`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, Accept: 'application/json' },
  }).then((r) => r.json());

  const id = list?.data?.[0]?.id;
  if (!id) return null;

  return fetch(`${N8N_BASE}/api/v1/executions/${id}?includeData=true`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY, Accept: 'application/json' },
  }).then((r) => r.json());
}

function findTokenUsage(node, path, depth, hits) {
  if (!node || typeof node !== 'object' || depth > 15) return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      findTokenUsage(node[i], `${path}[${i}]`, depth + 1, hits);
    }
    return;
  }
  if (TOKEN_KEYS.some((k) => k in node)) {
    hits.push({ path, value: node });
  }
  for (const k of Object.keys(node)) {
    findTokenUsage(node[k], `${path}.${k}`, depth + 1, hits);
  }
}

function summarizeUsage(u) {
  const inT  = u.input_tokens  ?? u.promptTokens     ?? u.inputTokens  ?? null;
  const outT = u.output_tokens ?? u.completionTokens ?? u.outputTokens ?? null;
  const cacheR = u.cache_read_input_tokens ?? null;
  const cacheW = u.cache_creation_input_tokens ?? null;
  const parts = [];
  if (inT !== null)    parts.push(`in=${inT}`);
  if (outT !== null)   parts.push(`out=${outT}`);
  if (cacheR !== null) parts.push(`cacheR=${cacheR}`);
  if (cacheW !== null) parts.push(`cacheW=${cacheW}`);
  return parts.join(' ') || JSON.stringify(u).slice(0, 100);
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  bold('── Deep debug: deal-assistant-chat agent output ──');

  const investor = await pickInvestor();
  const deal = await pickDeal();
  if (!investor) fail('No investor user found');
  if (!deal)     fail('No accessible deal found');
  ok(`user: ${investor.full_name ?? investor.id}`);
  ok(`deal: ${deal.name} (${deal.id})`);

  bold('── Triggering chat turn ──');
  const chat = await sendChat(investor.id, deal.id);
  if (chat.status !== 200) {
    warn(`chat returned status=${chat.status}`);
    dim(JSON.stringify(chat.data).slice(0, 500));
  } else {
    ok(`chat status=${chat.status} latency=${chat.latencyMs}ms`);
    dim(`response: ${JSON.stringify(chat.data).slice(0, 200)}`);
  }

  // n8n executions are written async; let it settle.
  await new Promise((r) => setTimeout(r, 1500));

  bold('── Fetching latest execution ──');
  const exec = await fetchLatestExecution();
  if (!exec) fail('No execution returned. Check N8N_API_KEY and the workflow id.');

  const outFile = `n8n-debug-${exec.id ?? Date.now()}.json`;
  fs.writeFileSync(outFile, JSON.stringify(exec, null, 2));
  ok(`full execution dumped to ${outFile} (${(fs.statSync(outFile).size / 1024).toFixed(1)} KB)`);

  const runData = exec?.data?.resultData?.runData ?? {};
  const allNodes = Object.keys(runData);
  dim(`nodes that ran: ${allNodes.join(', ')}`);

  // Per-node walk for nodes of interest.
  for (const name of NODES_OF_INTEREST) {
    bold(`── Node: ${name} ──`);
    const runs = runData[name];
    if (!runs) {
      warn(`did not run (or missing from runData)`);
      continue;
    }
    runs.forEach((run, idx) => {
      const inputs  = run?.data?.main ?? null;   // input pins (rarely present in n8n executions)
      const outputs = run?.data?.main ?? null;   // output pins
      // n8n run shape: data: { main: [[ {json: {...}}, ... ]] }
      const outArr = run?.data?.main?.[0] ?? [];

      const hits = [];
      findTokenUsage(outArr, `${name}[${idx}].output`, 0, hits);

      if (hits.length === 0) {
        warn(`run ${idx}: no usage objects found in output`);
      } else {
        ok(`run ${idx}: ${hits.length} usage object(s) found`);
        for (const h of hits) {
          console.log(`  ${C.cyan}${h.path}${C.reset}  →  ${summarizeUsage(h.value)}`);
        }
      }
    });
  }

  // Also a global sweep across the whole runData — sometimes usage data ends
  // up in unexpected nodes.
  bold('── Global sweep (any node, anywhere) ──');
  const globalHits = [];
  findTokenUsage(runData, 'runData', 0, globalHits);
  // Dedupe by stringified value so we don't print the same object twice.
  const seen = new Set();
  for (const h of globalHits) {
    const key = JSON.stringify(h.value);
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${C.cyan}${h.path}${C.reset}  →  ${summarizeUsage(h.value)}`);
  }
  if (globalHits.length === 0) {
    warn('no token-usage objects anywhere in the execution. The agent may have failed before the LLM call.');
  }

  console.log('');
  ok(`done. Inspect ${outFile} for the full structure.`);
  console.log(`${C.dim}Tip: jq '.data.resultData.runData["AI Agent"][0].data.main[0][0].json' ${outFile}  to see just the agent output.${C.reset}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
