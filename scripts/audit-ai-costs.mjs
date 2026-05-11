#!/usr/bin/env node
/**
 * Deep cost audit for the Deal AI Assistant.
 *
 * Fires a representative set of questions through the live n8n chat webhook,
 * pulls the resulting rows from terminal_ai_messages, and (if N8N_API_KEY is
 * set) cross-references the actual n8n executions to recover real tool-call
 * observation sizes that the DB-side preview truncates to 500 bytes.
 *
 * Usage:
 *   AUDIT_DEAL_NAME=florida \
 *   node --env-file=.env.local scripts/audit-ai-costs.mjs
 *
 * Env (already used by other scripts):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   N8N_BASE_URL
 *   N8N_WEBHOOK_PATH_CHAT
 *
 * Optional:
 *   N8N_API_KEY        - personal API key from n8n; unlocks execution detail
 *   AUDIT_DEAL_ID      - exact deal uuid (overrides AUDIT_DEAL_NAME)
 *   AUDIT_DEAL_NAME    - fuzzy name match (e.g. "florida")
 *   AUDIT_USER_ID      - user uuid; defaults to first investor
 */

const URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY          = process.env.SUPABASE_SERVICE_ROLE_KEY;
const N8N          = process.env.N8N_BASE_URL;
const PATH_CHAT    = process.env.N8N_WEBHOOK_PATH_CHAT;
const N8N_API_KEY  = process.env.N8N_API_KEY;
const N8N_API_URL  = (process.env.N8N_API_URL || N8N + '/api/v1').replace(/\/+$/, '');
const CHAT_WORKFLOW_ID = '6hz22YdBC500tHxg';

if (!URL || !KEY || !N8N || !PATH_CHAT) {
  console.error('Missing env. Run: node --env-file=.env.local scripts/audit-ai-costs.mjs');
  process.exit(1);
}

let DEAL_ID = process.env.AUDIT_DEAL_ID || null;
const DEAL_NAME_HINT = process.env.AUDIT_DEAL_NAME || null;

// Anthropic Sonnet 4.5/4.6 list prices, USD per 1M tokens.
const PRICE = { input: 3.00, output: 15.00, cache_write: 3.75, cache_read: 0.30 };

// Real workflow constants we measured.
const REAL_SYSTEM_PROMPT_CHARS    = 7800;
const ESTIMATED_BUDGET_IN_CODE    = 4500; // workflow's char budget used in Capture Metrics
const UNDERCOUNT_TOKENS_PER_TURN  = Math.round((REAL_SYSTEM_PROMPT_CHARS - ESTIMATED_BUDGET_IN_CODE) / 4);

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};

const sb = (path) =>
  fetch(`${URL}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
    .then((r) => r.json());

const sbDelete = (path) =>
  fetch(`${URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'return=minimal' },
  });

const n8nApi = async (path) => {
  if (!N8N_API_KEY) return null;
  try {
    const r = await fetch(`${N8N_API_URL}${path}`, { headers: { 'X-N8N-API-KEY': N8N_API_KEY } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
};

function unwrapText(message) {
  if (message == null) return '';
  if (typeof message === 'string') {
    const t = message.trim();
    if (t.startsWith('{')) {
      try { const j = JSON.parse(t); return j.text ?? j.message ?? message; } catch { return message; }
    }
    return message;
  }
  if (typeof message === 'object') return message.text ?? message.content ?? JSON.stringify(message);
  return String(message);
}

async function sendChat({ userId, dealId, message, conversationId }) {
  const body = { user_id: userId, deal_id: dealId, message };
  if (conversationId) body.conversation_id = conversationId;
  const t0 = Date.now();
  const r = await fetch(`${N8N}${PATH_CHAT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return {
    httpStatus: r.status,
    latencyMs: Date.now() - t0,
    raw: data,
    text: unwrapText(data.message),
    conversation_id: data.conversation_id,
    message_id: data.message_id,
  };
}

const fmtUsd = (n) => n < 0.001 ? `$${n.toFixed(6)}` : n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
const fmtKB  = (b) => b == null ? '?' : `${(b / 1024).toFixed(1)} KB`;
const approxBytes = (v) => { try { return typeof v === 'string' ? v.length : JSON.stringify(v).length; } catch { return 0; } };

// Pull the n8n execution that matches a conversation_id by scanning recent
// executions and looking inside their data.
async function findExecutionForConversation(conversationId) {
  if (!N8N_API_KEY) return null;
  const list = await n8nApi(`/executions?workflowId=${CHAT_WORKFLOW_ID}&limit=10&includeData=true`);
  if (!list?.data) return null;
  for (const ex of list.data) {
    const blob = JSON.stringify(ex.data || {});
    if (blob.includes(conversationId)) return ex;
  }
  return null;
}

// Inside an execution, find Get Deal / Get Tenants / Get Documents / Get Addresses
// node runs and report the byte size of their main output (what went into the LLM context).
function extractToolSizes(execution) {
  if (!execution?.data?.resultData?.runData) return [];
  const runs = execution.data.resultData.runData;
  const toolNames = ['Get Deal', 'Get Tenants', 'Get Documents', 'Get Addresses'];
  const sizes = [];
  for (const name of toolNames) {
    const arr = runs[name];
    if (!arr) continue;
    for (let i = 0; i < arr.length; i++) {
      const main = arr[i]?.data?.main?.[0];
      if (!main) continue;
      const bytes = approxBytes(main);
      const rows  = Array.isArray(main) ? main.length : null;
      sizes.push({ tool: name, callIdx: i, bytes, rows });
    }
  }
  return sizes;
}

const QUESTIONS = [
  {
    label: 'Q1 narrow numeric',
    text:  'What is the cap rate?',
    expects: 'Get Deal only. Should return a single number with brief context.',
  },
  {
    label: 'Q2 top tenants (smoking gun)',
    text:  'Top 3 tenants by SF in Palatka Promenade?',
    expects: 'Should call Get Addresses then Get Tenants with limit ~3. AFTER fix: tiny observation. BEFORE: full 55-row dump.',
  },
  {
    label: 'Q3 full rent roll',
    text:  'Show me the complete rent roll for Palatka Promenade with tenant name, SF, and lease expiry.',
    expects: 'Get Tenants with limit ~50. Tests whether AI sets a high limit when the user asks for everything.',
  },
  {
    label: 'Q4 documents',
    text:  'What financial documents are available for due diligence on this deal?',
    expects: 'Get Documents with limit ~10-20. AFTER fix: capped. BEFORE: 828-row dump risk.',
  },
  {
    label: 'Q5 memory reuse',
    text:  'Of the tenants you mentioned, which has the highest annual base rent?',
    expects: 'NO tool call — answer from memory of Q2/Q3. Confirms history is being used.',
  },
];

function summaryRow(label, valueA, valueB, delta) {
  return `  ${label.padEnd(34)} ${String(valueA).padStart(12)}   ${String(valueB).padStart(12)}   ${delta}`;
}

async function main() {
  console.log(`${C.bold}${C.cyan}Deal Assistant — Deep Cost Audit${C.reset}`);
  console.log(`${C.dim}n8n execution detail: ${N8N_API_KEY ? 'ENABLED (real tool obs sizes)' : 'DISABLED — set N8N_API_KEY to unlock'}${C.reset}\n`);

  // Resolve user.
  let userId = process.env.AUDIT_USER_ID;
  if (!userId) {
    const investor = (await sb(`terminal_users?select=id&role=eq.investor&limit=1`))?.[0];
    if (!investor) { console.error('No investor user found. Set AUDIT_USER_ID.'); process.exit(1); }
    userId = investor.id;
  }

  // Resolve deal.
  if (!DEAL_ID && DEAL_NAME_HINT) {
    const matches = await sb(`terminal_deals?select=id,name,is_portfolio&name=ilike.*${encodeURIComponent(DEAL_NAME_HINT)}*&limit=5`);
    if (!matches?.length) { console.error(`No deal matched "${DEAL_NAME_HINT}".`); process.exit(1); }
    if (matches.length > 1) {
      console.log(`${C.yellow}Multiple deals matched:${C.reset}`);
      for (const m of matches) console.log(`  ${m.id}  ${m.name}`);
      console.log(`Re-run with AUDIT_DEAL_ID=<id>`);
      process.exit(1);
    }
    DEAL_ID = matches[0].id;
  }
  if (!DEAL_ID) DEAL_ID = '00173b9d-14af-42e9-ab4d-91f59b16c5cc';

  const deal = (await sb(`terminal_deals?select=id,name,status,is_portfolio&id=eq.${DEAL_ID}`))?.[0];
  if (!deal) { console.error(`Deal ${DEAL_ID} not found.`); process.exit(1); }

  const tenantCount = (await sb(`tenant_leases?select=id&deal_id=eq.${DEAL_ID}`))?.length ?? 0;
  const addrCount   = (await sb(`terminal_deal_addresses?select=id&deal_id=eq.${DEAL_ID}`))?.length ?? 0;
  const docCount    = (await sb(`terminal_dd_documents?select=id&deal_id=eq.${DEAL_ID}`))?.length ?? 0;

  console.log(`${C.bold}Deal:${C.reset} ${deal.name}`);
  console.log(`      ${deal.status}, portfolio=${deal.is_portfolio}`);
  console.log(`      ${C.bold}${tenantCount}${C.reset} tenants · ${C.bold}${addrCount}${C.reset} addresses · ${C.bold}${docCount}${C.reset} documents`);
  console.log(`      User: ${userId}\n`);

  let conversationId = null;
  const rows = [];

  for (const q of QUESTIONS) {
    console.log(`${C.bold}${q.label}${C.reset}`);
    console.log(`  ${C.dim}${q.expects}${C.reset}`);
    console.log(`  ${C.cyan}Q:${C.reset} ${q.text}`);

    const res = await sendChat({ userId, dealId: DEAL_ID, message: q.text, conversationId });
    if (!conversationId && res.conversation_id) conversationId = res.conversation_id;

    if (res.httpStatus !== 200) {
      console.log(`  ${C.red}HTTP ${res.httpStatus}${C.reset} ${JSON.stringify(res.raw).slice(0, 250)}\n`);
      continue;
    }

    const answer = (res.text || '').toString().replace(/\n/g, ' ').trim();
    console.log(`  ${C.green}A:${C.reset} ${answer ? answer.slice(0, 240) + (answer.length > 240 ? '…' : '') : `${C.yellow}<empty>${C.reset}`}`);

    // Settle, then read the assistant row.
    await new Promise((r) => setTimeout(r, 2500));
    const msgs = await sb(
      `terminal_ai_messages?select=id,role,content,tool_calls,model,input_tokens,output_tokens,latency_ms,created_at` +
      `&conversation_id=eq.${conversationId}&role=eq.assistant&order=created_at.desc&limit=1`
    );
    const m = msgs?.[0];
    if (!m) {
      console.log(`  ${C.yellow}!${C.reset} no assistant row — workflow may have skipped Save Assistant Message\n`);
      continue;
    }

    // Try to fetch the n8n execution for ground truth.
    const exec = await findExecutionForConversation(conversationId);
    const realToolSizes = exec ? extractToolSizes(exec) : [];

    const toolsArr = Array.isArray(m.tool_calls) ? m.tool_calls : [];
    const dbToolBytes = toolsArr.reduce((s, t) => s + ((typeof t.observation_preview === 'string') ? t.observation_preview.length : 0), 0);
    const realToolBytes = realToolSizes.reduce((s, t) => s + (t.bytes || 0), 0);

    const reportedIn  = m.input_tokens ?? 0;
    const reportedOut = m.output_tokens ?? 0;
    const correctedIn = reportedIn + UNDERCOUNT_TOKENS_PER_TURN;
    const reportedCost  = (reportedIn / 1e6) * PRICE.input + (reportedOut / 1e6) * PRICE.output;
    const correctedCost = (correctedIn / 1e6) * PRICE.input + (reportedOut / 1e6) * PRICE.output;

    rows.push({
      label: q.label, reportedIn, reportedOut, correctedIn,
      reportedCost, correctedCost,
      latency: res.latencyMs,
      tools: toolsArr.length,
      dbToolBytes,
      realToolSizes,
      realToolBytes: realToolSizes.length ? realToolBytes : null,
    });

    // Per-turn output.
    console.log(`     ${C.magenta}tokens${C.reset}  reported in=${reportedIn} out=${reportedOut}   ${C.dim}corrected in≈${correctedIn} (+${UNDERCOUNT_TOKENS_PER_TURN} system-prompt undercount)${C.reset}`);
    console.log(`     ${C.magenta}cost${C.reset}    reported ${fmtUsd(reportedCost)}   corrected ${fmtUsd(correctedCost)}`);

    if (toolsArr.length === 0) {
      console.log(`     ${C.magenta}tools${C.reset}   DB shows 0 calls. raw column: ${C.dim}${JSON.stringify(m.tool_calls).slice(0, 140)}${C.reset}`);
    } else {
      console.log(`     ${C.magenta}tools${C.reset}   DB shows ${toolsArr.length} call(s), preview total ${fmtKB(dbToolBytes)} ${C.yellow}(DB caps each preview at 500B)${C.reset}`);
      for (const t of toolsArr) {
        const obs = t.observation_preview ?? '';
        const obsLen = typeof obs === 'string' ? obs.length : approxBytes(obs);
        console.log(`       ${C.dim}· ${t.tool || '?'}  obs_preview=${obsLen}B${obsLen >= 500 ? ' (capped)' : ''}${C.reset}`);
      }
    }

    if (realToolSizes.length) {
      console.log(`     ${C.green}n8n exec${C.reset} ${realToolSizes.length} tool run(s), real total ${fmtKB(realToolBytes)} ${C.bold}← what actually went into Claude${C.reset}`);
      for (const t of realToolSizes) {
        console.log(`       ${C.dim}· ${t.tool} call#${t.callIdx + 1}  ${fmtKB(t.bytes)}${t.rows != null ? `  (${t.rows} rows)` : ''}${C.reset}`);
      }
    } else if (N8N_API_KEY) {
      console.log(`     ${C.dim}n8n exec lookup found nothing for this conversation${C.reset}`);
    }

    console.log(`     ${C.dim}model=${m.model || '?'}  latency=${(res.latencyMs / 1000).toFixed(1)}s${C.reset}\n`);
  }

  // Aggregate.
  if (rows.length) {
    const tot = rows.reduce((a, r) => ({
      reportedIn:    a.reportedIn    + r.reportedIn,
      reportedOut:   a.reportedOut   + r.reportedOut,
      correctedIn:   a.correctedIn   + r.correctedIn,
      reportedCost:  a.reportedCost  + r.reportedCost,
      correctedCost: a.correctedCost + r.correctedCost,
      tools:         a.tools         + r.tools,
      dbToolBytes:   a.dbToolBytes   + r.dbToolBytes,
      realToolBytes: a.realToolBytes + (r.realToolBytes ?? 0),
      latency:       a.latency       + r.latency,
    }), { reportedIn: 0, reportedOut: 0, correctedIn: 0, reportedCost: 0, correctedCost: 0, tools: 0, dbToolBytes: 0, realToolBytes: 0, latency: 0 });

    console.log(`${C.bold}Per-question summary${C.reset}`);
    console.log(`  ${''.padEnd(34)} ${'reported in'.padStart(12)}   ${'reported out'.padStart(12)}   ${'corrected $'.padStart(12)}   real-tools`);
    for (const r of rows) {
      const real = r.realToolBytes != null ? fmtKB(r.realToolBytes) : '—';
      console.log(`  ${r.label.padEnd(34)} ${String(r.reportedIn).padStart(12)}   ${String(r.reportedOut).padStart(12)}   ${fmtUsd(r.correctedCost).padStart(12)}   ${real}`);
    }
    console.log();

    console.log(`${C.bold}Totals across ${rows.length} turn(s)${C.reset}`);
    console.log(`  reported tokens:   in=${tot.reportedIn}  out=${tot.reportedOut}`);
    console.log(`  corrected tokens:  in≈${tot.correctedIn}  out=${tot.reportedOut}  (system-prompt undercount: +${UNDERCOUNT_TOKENS_PER_TURN}/turn)`);
    console.log(`  reported cost:     ${fmtUsd(tot.reportedCost)}`);
    console.log(`  ${C.bold}corrected cost:    ${fmtUsd(tot.correctedCost)}${C.reset}  ${C.yellow}← closer to real Anthropic billing${C.reset}`);
    console.log(`  per-turn avg:      ${fmtUsd(tot.correctedCost / rows.length)}`);
    if (tot.realToolBytes) {
      console.log(`  ${C.green}real tool obs:     ${fmtKB(tot.realToolBytes)} total${C.reset}  ${C.dim}(from n8n executions API)${C.reset}`);
    }
    console.log(`  total latency:     ${(tot.latency / 1000).toFixed(1)}s`);
  }

  console.log(`\n${C.bold}Things this audit cannot see${C.reset}`);
  console.log(`  ${C.dim}· Real Anthropic input/output tokens — workflow records a char/4 estimate.${C.reset}`);
  console.log(`  ${C.dim}· Whether prompt caching is in effect — n8n Anthropic node does not expose cache_control.${C.reset}`);
  console.log(`  ${C.dim}· Cost of memory replay across long sessions — only sampled here at 5 turns.${C.reset}`);

  if (conversationId) {
    console.log(`\n${C.dim}Cleaning up conversation ${conversationId}…${C.reset}`);
    await sbDelete(`terminal_ai_messages?conversation_id=eq.${conversationId}`);
    await sbDelete(`terminal_ai_conversations?id=eq.${conversationId}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
