#!/usr/bin/env node
/**
 * Direct ingestion test + verbose debugger — drives the n8n ingestion webhook
 * itself, no backfill cron / schedule node involved. Picks N not-yet-succeeded
 * docs for one deal, resets them, fires them through ONE AT A TIME, and logs
 * EVERYTHING: the doc row, the webhook request + response body, every poll,
 * the final status, the last_error in full, and (on success) the chunks that
 * landed in terminal_doc_chunks.
 *
 * Usage:
 *   node --env-file=.env.local scripts/test-ingest-docs.mjs [deal_id] [limit]
 *
 * Defaults: deal_id = 818fc699-..., limit = 10
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   N8N_INGEST_WEBHOOK_URL
 */

import { createClient } from '@supabase/supabase-js';

const DEAL_ID = process.argv[2] || '818fc699-0ee6-49a1-8bed-9a32f931cc99';
const LIMIT = Number(process.argv[3] || 10);
const POLL_MS = 5_000;
const PER_DOC_TIMEOUT_MS = 6 * 60_000;

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m',
};
const ts = () => new Date().toISOString().slice(11, 23);
const log = (m) => console.log(`${c.gray}${ts()}${c.reset} ${m}`);
const step = (m) => console.log(`${c.gray}${ts()}${c.reset} ${c.blue}▶${c.reset} ${m}`);
const ok = (m) => console.log(`${c.gray}${ts()}${c.reset} ${c.green}✓ ${m}${c.reset}`);
const bad = (m) => console.log(`${c.gray}${ts()}${c.reset} ${c.red}✗ ${m}${c.reset}`);
const warn = (m) => console.log(`${c.gray}${ts()}${c.reset} ${c.yellow}! ${m}${c.reset}`);
const dim = (m) => console.log(`${c.gray}${ts()}   ${m}${c.reset}`);
const banner = (m) => console.log(`\n${c.bold}${c.cyan}━━━━━ ${m} ━━━━━${c.reset}`);
const kv = (k, v) => console.log(`${c.gray}${ts()}   ${c.dim}${String(k).padEnd(16)}${c.reset} ${v}`);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`${c.red}Missing env var: ${name}${c.reset}`); process.exit(1); }
  return v;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const WEBHOOK_URL = requireEnv('N8N_INGEST_WEBHOOK_URL');
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const fmtBytes = (n) => {
  const x = Number(n);
  if (!x || Number.isNaN(x)) return String(n ?? '');
  if (x < 1024) return `${x} B`;
  if (x < 1048576) return `${(x / 1024).toFixed(1)} KB`;
  return `${(x / 1048576).toFixed(2)} MB`;
};

banner('CONFIG');
kv('deal_id', DEAL_ID);
kv('limit', LIMIT);
kv('webhook', WEBHOOK_URL);
kv('supabase', SUPABASE_URL);
kv('poll interval', `${POLL_MS / 1000}s`);
kv('per-doc cap', `${PER_DOC_TIMEOUT_MS / 60000} min`);

// ─── 1. snapshot the deal's current state ───────────────────────────────────
banner('DEAL SNAPSHOT (before)');
{
  const { data, error } = await admin
    .from('terminal_dd_documents')
    .select('indexing_status')
    .eq('deal_id', DEAL_ID);
  if (error) { bad(`snapshot query failed: ${error.message}`); process.exit(1); }
  const counts = {};
  for (const r of data) counts[r.indexing_status] = (counts[r.indexing_status] || 0) + 1;
  kv('total docs', data.length);
  for (const [k, v] of Object.entries(counts)) kv(k, v);
}

// ─── 2. pick docs to test ───────────────────────────────────────────────────
banner(`PICK up to ${LIMIT} non-succeeded docs`);
const { data: picked, error: pickErr } = await admin
  .from('terminal_dd_documents')
  .select('id, name, file_type, file_size, storage_path, indexing_status, attempts, source_kind, created_at')
  .eq('deal_id', DEAL_ID)
  .neq('indexing_status', 'succeeded')
  .order('created_at', { ascending: true })
  .limit(LIMIT);

if (pickErr) { bad(`pick failed: ${pickErr.message}`); process.exit(1); }
if (!picked || picked.length === 0) { warn('Nothing to test — no non-succeeded docs on this deal.'); process.exit(0); }

picked.forEach((d, i) => {
  console.log(`${c.gray}${ts()}${c.reset} ${c.bold}[${i + 1}] ${d.name}${c.reset}`);
  kv('  id', d.id);
  kv('  file_type', d.file_type);
  kv('  file_size', fmtBytes(d.file_size));
  kv('  source_kind', d.source_kind);
  kv('  status now', `${d.indexing_status} (attempts=${d.attempts})`);
  kv('  storage_path', d.storage_path);
});

// ─── 3. reset to clean pending state ────────────────────────────────────────
banner('RESET picked docs → pending / attempts=0');
const ids = picked.map((d) => d.id);
{
  const { error } = await admin
    .from('terminal_dd_documents')
    .update({ indexing_status: 'pending', attempts: 0, last_error: null })
    .in('id', ids);
  if (error) { bad(`reset failed: ${error.message}`); process.exit(1); }
  ok(`${ids.length} docs reset`);
}

// ─── 4. fire one at a time, poll verbosely ──────────────────────────────────
banner('INGEST — one doc at a time');
const results = [];
let docNum = 0;

for (const doc of picked) {
  docNum += 1;
  console.log(`\n${c.bold}${c.magenta}┌─ [${docNum}/${picked.length}] ${doc.name}${c.reset}`);
  kv('document_id', doc.id);
  const t0 = Date.now();

  // fire webhook
  step('POST ingest webhook');
  const reqBody = { document_id: doc.id, deal_id: DEAL_ID };
  kv('request body', JSON.stringify(reqBody));
  let fired = false;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });
    const text = await res.text();
    kv('response status', `HTTP ${res.status}`);
    kv('response body', text ? text.slice(0, 500) : '(empty)');
    fired = true;
  } catch (err) {
    warn(`webhook fetch threw: ${err.message}`);
    dim('(continuing — the ingestion execution may still be running; poll will catch it)');
  }

  // poll
  step('Polling terminal_dd_documents until terminal…');
  let last = '';
  let row = null;
  let polls = 0;
  while (Date.now() - t0 < PER_DOC_TIMEOUT_MS) {
    polls += 1;
    const { data, error } = await admin
      .from('terminal_dd_documents')
      .select('indexing_status, attempts, last_error, indexed_at')
      .eq('id', doc.id)
      .maybeSingle();
    if (error) { warn(`poll ${polls} query error: ${error.message}`); }
    row = data;
    const st = row?.indexing_status ?? 'unknown';
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    if (st !== last) {
      log(`  ${c.bold}status → ${st}${c.reset}  ${c.dim}(poll ${polls}, ${elapsed}s, attempts=${row?.attempts ?? '?'})${c.reset}`);
      last = st;
    } else {
      dim(`  poll ${polls}: still ${st} (${elapsed}s)`);
    }
    if (st === 'succeeded' || st === 'failed') break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);

  if (row?.indexing_status === 'succeeded') {
    ok(`SUCCEEDED in ${elapsed}s`);
    // verify chunks landed
    const { data: chunks } = await admin
      .from('terminal_doc_chunks')
      .select('embedding_model', { count: 'exact' })
      .eq('document_id', doc.id);
    const models = [...new Set((chunks || []).map((x) => x.embedding_model))];
    kv('chunks written', `${chunks?.length ?? 0}`);
    kv('embedding_model', models.join(', ') || '(none)');
  } else if (row?.indexing_status === 'failed') {
    bad(`FAILED in ${elapsed}s  (attempts=${row?.attempts})`);
    console.log(`${c.gray}${ts()}   ${c.red}last_error (full):${c.reset}`);
    console.log(`${c.red}${row?.last_error ?? '(null)'}${c.reset}`);
  } else {
    warn(`NO TERMINAL STATE after ${elapsed}s — last status '${last}'`);
  }
  console.log(`${c.magenta}└─ done [${docNum}/${picked.length}]${c.reset}`);

  results.push({
    name: doc.name,
    file_type: doc.file_type,
    file_size: doc.file_size,
    status: row?.indexing_status ?? 'unknown',
    last_error: row?.last_error,
    seconds: elapsed,
  });
}

// ─── 5. final summary ───────────────────────────────────────────────────────
banner('SUMMARY');
const succeeded = results.filter((r) => r.status === 'succeeded');
const failed = results.filter((r) => r.status === 'failed');
const other = results.filter((r) => r.status !== 'succeeded' && r.status !== 'failed');

for (const r of results) {
  const tag = r.status === 'succeeded' ? `${c.green}✓ succeeded${c.reset}`
            : r.status === 'failed' ? `${c.red}✗ failed   ${c.reset}`
            : `${c.yellow}? ${r.status}${c.reset}`;
  console.log(`  ${tag}  ${String(r.seconds + 's').padEnd(6)} ${c.dim}${fmtBytes(r.file_size).padEnd(9)}${c.reset} ${r.name}`);
}

// group failures by error type
if (failed.length) {
  console.log(`\n${c.bold}Failure breakdown:${c.reset}`);
  const byErr = {};
  for (const r of failed) {
    const key = (r.last_error || 'unknown').replace(/\s+/g, ' ').slice(0, 80);
    byErr[key] = (byErr[key] || 0) + 1;
  }
  for (const [err, n] of Object.entries(byErr).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.red}${n}×${c.reset} ${err}`);
  }
}

console.log(`\n${c.bold}${results.length} docs tested:  ${c.green}${succeeded.length} succeeded${c.reset}${c.bold}  ·  ${c.red}${failed.length} failed${c.reset}${c.bold}  ·  ${c.yellow}${other.length} indeterminate${c.reset}`);
process.exit(failed.length > 0 ? 1 : 0);
