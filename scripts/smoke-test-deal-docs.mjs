#!/usr/bin/env node
/**
 * Phase 6 smoke test — promote every deal-level doc slot for one deal into
 * terminal_dd_documents and fire the n8n ingestion webhook for each.
 *
 * Hard-coded for "203 West Weber" because that deal has the full set:
 * OM, LOI, PSA, Full Report, Tenant Intelligence, Lease Summary.
 *
 * Usage:
 *   node --env-file=.env.local scripts/smoke-test-deal-docs.mjs
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   N8N_INGEST_WEBHOOK_URL
 */

import { createClient } from '@supabase/supabase-js';

const DEAL_NAME_PATTERN = '%203%west%weber%';
const POLL_INTERVAL_MS = 5_000;
const PER_DOC_TIMEOUT_MS = 4 * 60_000;   // per-doc cap; Apify run-sync timeout is 900s but typical runs ≤90s
const FORCE_REINGEST = process.argv.includes('--force');   // re-ingest succeeded rows too

const SLOTS = [
  { column: 'om_storage_path',             source_kind: 'deal_om',             name: 'Offering Memorandum' },
  { column: 'loi_signed_storage_path',     source_kind: 'deal_loi',            name: 'Signed LOI' },
  { column: 'psa_storage_path',            source_kind: 'deal_psa',            name: 'Purchase and Sale Agreement' },
  { column: 'full_report_storage_path',    source_kind: 'deal_full_report',    name: 'Full Report' },
  { column: 'costar_report_storage_path',  source_kind: 'deal_costar_report',  name: 'CoStar Report' },
  { column: 'tenants_report_storage_path', source_kind: 'deal_tenants_report', name: 'Tenants Report' },
  { column: 'lease_summary_storage_path',  source_kind: 'deal_lease_summary',  name: 'Lease Summary' },
];

const c = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m' };
const log = (msg) => console.log(msg);
const banner = (msg) => log(`\n${c.bold}${c.cyan}━━━ ${msg} ━━━${c.reset}`);
const ok = (msg) => log(`  ${c.green}✓${c.reset} ${msg}`);
const warn = (msg) => log(`  ${c.yellow}!${c.reset} ${msg}`);
const fail = (msg) => log(`  ${c.red}✗${c.reset} ${msg}`);
const info = (msg) => log(`  ${c.dim}${msg}${c.reset}`);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) { fail(`Missing env var: ${name}`); process.exit(1); }
  return v;
}

const SUPABASE_URL  = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY   = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const WEBHOOK_URL   = requireEnv('N8N_INGEST_WEBHOOK_URL');
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ─── Step 1. find the deal ─────────────────────────────────────────────────
banner('Find deal');
const { data: deals, error: dealErr } = await admin
  .from('terminal_deals')
  .select('id, name, ' + SLOTS.map((s) => s.column).join(', '))
  .ilike('name', DEAL_NAME_PATTERN);

if (dealErr) { fail(`Lookup failed: ${dealErr.message}`); process.exit(1); }
if (!deals || deals.length === 0) { fail(`No deal matched name LIKE '${DEAL_NAME_PATTERN}'`); process.exit(1); }
if (deals.length > 1) {
  warn(`${deals.length} deals matched; using first.`);
  deals.forEach((d) => info(`  - ${d.name} (${d.id})`));
}
const deal = deals[0];
ok(`${c.bold}${deal.name}${c.reset} (${deal.id})`);

// ─── Step 2. enumerate populated slots ────────────────────────────────────
banner('Slots populated on this deal');
const populated = SLOTS.filter((s) => deal[s.column]);
if (populated.length === 0) { fail('Deal has zero deal-level docs uploaded.'); process.exit(1); }
for (const s of SLOTS) {
  const path = deal[s.column];
  if (path) ok(`${s.name.padEnd(30)} → ${c.dim}${path}${c.reset}`);
  else      info(`${s.name.padEnd(30)} — empty, skipping`);
}

// ─── Step 3. for each populated slot, ensure a terminal_dd_documents row ──
banner('Promote slots into terminal_dd_documents');
const results = [];
for (const s of populated) {
  const path = deal[s.column];

  const { data: existing } = await admin
    .from('terminal_dd_documents')
    .select('id, indexing_status, storage_path')
    .eq('deal_id', deal.id)
    .eq('source_kind', s.source_kind)
    .maybeSingle();

  let docId, action;
  if (existing) {
    if (existing.storage_path === path) {
      // Skip succeeded rows by default. --force re-ingests them (re-pays Apify + Haiku).
      if (existing.indexing_status === 'succeeded' && !FORCE_REINGEST) {
        info(`${s.name.padEnd(30)} → ${existing.id}  ${c.dim}(already succeeded, skipping — use --force to re-ingest)${c.reset}`);
        continue;
      }
      // Re-use the existing row. Reset to pending so we re-ingest cleanly.
      const { error } = await admin
        .from('terminal_dd_documents')
        .update({ indexing_status: 'pending', last_error: null })
        .eq('id', existing.id);
      if (error) { fail(`${s.name}: reset failed — ${error.message}`); continue; }
      docId = existing.id;
      action = existing.indexing_status === 'succeeded' ? 'reused (forced reset)' : `reused (was ${existing.indexing_status}, reset → pending)`;
    } else {
      // Row exists but points at an older path. Delete + reinsert. Chunks cascade.
      await admin.from('terminal_dd_documents').delete().eq('id', existing.id);
      action = 'replaced (path changed)';
    }
  }
  if (!docId) {
    const { data: inserted, error: insErr } = await admin
      .from('terminal_dd_documents')
      .insert({
        deal_id: deal.id,
        folder_id: null,
        name: s.name,
        display_name: s.name,
        file_type: 'application/pdf',
        storage_path: path,
        source_kind: s.source_kind,
        indexing_status: 'pending',
      })
      .select('id')
      .single();
    if (insErr || !inserted) { fail(`${s.name}: insert failed — ${insErr?.message}`); continue; }
    docId = inserted.id;
    action = action || 'inserted';
  }
  ok(`${s.name.padEnd(30)} → ${docId}  ${c.dim}(${action})${c.reset}`);
  results.push({ slot: s, docId });
}

if (results.length === 0) { fail('Nothing to enqueue. Bailing.'); process.exit(1); }

// ─── Step 4. fire + wait per doc (serial, one at a time) ──────────────────
// Apify has an 8 GB total memory cap across concurrent Actor runs; the
// Docling Actor uses ~4 GB, so we run strictly one ingestion at a time.
banner('Ingest one at a time (Apify memory cap)');
const docIds = results.map((r) => r.docId);
const slotByDocId = new Map(results.map((r) => [r.docId, r.slot.name]));

for (const { slot, docId } of results) {
  log(`\n  ${c.bold}${slot.name}${c.reset}  ${c.dim}(${docId})${c.reset}`);

  // Fire the webhook
  const t0 = Date.now();
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: docId, deal_id: deal.id }),
    });
    info(`  fired webhook → HTTP ${res.status} in ${Date.now() - t0}ms`);
  } catch (err) {
    warn(`  webhook fetch threw — ${err.message} (continuing; the doc may still process)`);
  }

  // Poll this one doc until it settles or times out
  const startThis = Date.now();
  let lastStatus = '';
  while (Date.now() - startThis < PER_DOC_TIMEOUT_MS) {
    const { data: row } = await admin
      .from('terminal_dd_documents')
      .select('indexing_status, attempts, last_error')
      .eq('id', docId)
      .maybeSingle();

    const status = row?.indexing_status ?? 'unknown';
    if (status !== lastStatus) {
      info(`  status: ${status}  ${c.dim}(elapsed ${((Date.now() - startThis) / 1000).toFixed(0)}s)${c.reset}`);
      lastStatus = status;
    }
    if (status === 'succeeded') { ok('  done'); break; }
    if (status === 'failed') {
      fail(`  failed`);
      if (row?.last_error) info(`    last_error: ${row.last_error.slice(0, 200)}`);
      break;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  if (lastStatus !== 'succeeded' && lastStatus !== 'failed') {
    warn(`  timeout — last status was '${lastStatus}'`);
  }
}

// ─── Step 6. final summary ────────────────────────────────────────────────
banner('Final state');
const { data: finalRows } = await admin
  .from('terminal_dd_documents')
  .select('id, name, source_kind, indexing_status, attempts, last_error')
  .in('id', docIds);

const { data: chunkCounts } = await admin
  .from('terminal_doc_chunks')
  .select('document_id')
  .in('document_id', docIds);
const chunkByDoc = (chunkCounts ?? []).reduce((acc, r) => { acc[r.document_id] = (acc[r.document_id] || 0) + 1; return acc; }, {});

let allGreen = true;
for (const r of (finalRows ?? [])) {
  const chunks = chunkByDoc[r.id] || 0;
  const slot = slotByDocId.get(r.id) || r.name;
  if (r.indexing_status === 'succeeded') {
    ok(`${slot.padEnd(30)}  succeeded  chunks=${chunks}  attempts=${r.attempts}`);
  } else if (r.indexing_status === 'failed') {
    allGreen = false;
    fail(`${slot.padEnd(30)}  failed     attempts=${r.attempts}`);
    if (r.last_error) info(`    last_error: ${r.last_error.slice(0, 200)}`);
  } else {
    allGreen = false;
    warn(`${slot.padEnd(30)}  ${r.indexing_status}  attempts=${r.attempts}  (timeout — still running)`);
  }
}

log('');
if (allGreen) log(`${c.bold}${c.green}All ${results.length} deal-level docs succeeded.${c.reset}`);
else          log(`${c.bold}${c.yellow}Finished with at least one non-success. Inspect rows above + n8n executions.${c.reset}`);
log(`\n${c.dim}Next: open the chat on deal "${deal.name}" and ask "what does the OM say about the asset?" — confirm the agent returns a citation chip.${c.reset}\n`);

process.exit(allGreen ? 0 : 1);
