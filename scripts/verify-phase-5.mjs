#!/usr/bin/env node
/**
 * Phase 5 verification.
 *
 * Confirms the Supabase schema is correct, both RPCs round-trip, and
 * (optionally) the live n8n ingestion webhook works end-to-end on a real
 * document.
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-phase-5.mjs
 *   node --env-file=.env.local scripts/verify-phase-5.mjs --doc-id <uuid>
 *
 * Required env (same vars the other scripts use):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env (each one only unlocks one extra check — script never fails
 * just because a provider key is missing locally; those keys live in the n8n
 * vault and Vercel server env, not on your laptop):
 *   N8N_BASE_URL          → enables the --doc-id end-to-end webhook test
 *   GOOGLE_API_KEY        → sanity-pings gemini-embedding-001
 *   COHERE_API_KEY        → sanity-pings cohere rerank
 *   ANTHROPIC_API_KEY     → sanity-pings haiku
 *
 * Exit code: 0 if every REQUIRED check passes, 1 otherwise. Missing optional
 * env never fails the run; it's just reported as "skipped".
 */

import { createClient } from '@supabase/supabase-js';

// ─── pretty printing ────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
let failures = 0;
const step = (s) => console.log(`\n${C.bold}${C.cyan}▸ ${s}${C.reset}`);
const pass = (s) => console.log(`  ${C.green}✓${C.reset} ${s}`);
const fail = (s, e) => { failures++; console.log(`  ${C.red}✗${C.reset} ${s}`); if (e) console.log(`    ${C.dim}${e}${C.reset}`); };
const skip = (s) => console.log(`  ${C.yellow}○${C.reset} ${s}  ${C.dim}(skipped)${C.reset}`);
const info = (s) => console.log(`  ${C.dim}${s}${C.reset}`);

// ─── required env ───────────────────────────────────────────────────────────
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error(`${C.red}Missing env. Run: node --env-file=.env.local scripts/verify-phase-5.mjs${C.reset}`);
  process.exit(1);
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ─── arg parsing (--doc-id, --deal-id) ──────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.replace(/^--/, '')] = process.argv[++i];
}

// ─── 1. schema: terminal_doc_chunks ─────────────────────────────────────────
step('Supabase schema — terminal_doc_chunks');
{
  const { error } = await admin.from('terminal_doc_chunks').select('id', { head: true, count: 'exact' });
  if (error) fail('terminal_doc_chunks not found or not accessible', error.message);
  else pass('terminal_doc_chunks table exists');
}

// ─── 2. schema: terminal_dd_documents new columns ───────────────────────────
step('Supabase schema — terminal_dd_documents new columns');
{
  const { error } = await admin.from('terminal_dd_documents').select('id, indexed_at, do_not_index').limit(1);
  if (error) fail('terminal_dd_documents missing indexed_at or do_not_index', error.message);
  else pass('terminal_dd_documents has indexed_at and do_not_index');
}

// ─── 3. RPC round-trip ──────────────────────────────────────────────────────
step('RPC round-trip — replace_doc_chunks + search_doc_chunks');
{
  // Find any deal that has at least one document, so the FKs are satisfied.
  const { data: dealRow } = await admin
    .from('terminal_dd_documents')
    .select('id, deal_id')
    .limit(1)
    .maybeSingle();
  if (!dealRow) {
    skip('no terminal_dd_documents row exists yet — upload one document first or pass --doc-id');
  } else {
    const testDealId = dealRow.deal_id;
    const testDocId = dealRow.id;
    const fakeEmbedding = Array.from({ length: 1536 }, (_, i) => (i % 7) * 0.001 - 0.003);
    const chunks = [{
      chunk_index: 0, page_start: null, page_end: null,
      content: 'Phase I ESA contamination disclosure: TCE detected on the eastern parcel.',
      context: 'Verification test chunk for Phase 5 setup — not real ESA content.',
      embedding: fakeEmbedding, token_count: 42,
    }];

    // We have to be careful here — if this doc has REAL chunks already, the
    // RPC will delete them. Bail out instead of corrupting real data.
    const { count: existing } = await admin
      .from('terminal_doc_chunks').select('id', { count: 'exact', head: true })
      .eq('document_id', testDocId);
    if (existing && existing > 0) {
      skip(`document ${testDocId} already has ${existing} real chunk(s); refusing to overwrite — pass --doc-id <other uuid>`);
    } else {
      const { data: inserted, error: insErr } = await admin.rpc('replace_doc_chunks', {
        p_document_id: testDocId, p_deal_id: testDealId, p_chunks: chunks,
      });
      if (insErr) fail('replace_doc_chunks RPC failed', insErr.message);
      else pass(`replace_doc_chunks inserted ${inserted} chunk(s)`);

      const { data: searchRows, error: srchErr } = await admin.rpc('search_doc_chunks', {
        query_embedding: fakeEmbedding, p_deal_id: testDealId,
        query_text: 'contamination TCE', k: 5,
      });
      if (srchErr) fail('search_doc_chunks RPC failed', srchErr.message);
      else if (!searchRows || searchRows.length === 0) fail('search_doc_chunks returned 0 rows for our own embedding');
      else pass(`search_doc_chunks returned ${searchRows.length} row(s) — RRF + HNSW + tsvector all working`);

      // Clean up: write zero chunks so we don't leave the fake row behind.
      const { error: clearErr } = await admin.rpc('replace_doc_chunks', {
        p_document_id: testDocId, p_deal_id: testDealId, p_chunks: [],
      });
      if (clearErr) fail('cleanup failed — manually delete the test chunk', clearErr.message);
      else pass('test chunk cleaned up');

      // ⚠️ The RPC bumps terminal_dd_documents.indexed_at every time it runs.
      // Reset it so we don't fool the backfill scanner.
      await admin.from('terminal_dd_documents').update({ indexed_at: null }).eq('id', testDocId);
      info(`indexed_at reset to null on document ${testDocId}`);
    }
  }
}

// ─── 4. Gemini (optional) ───────────────────────────────────────────────────
step('Gemini — gemini-embedding-001 @ 1536d');
if (!process.env.GOOGLE_API_KEY) skip('GOOGLE_API_KEY not set locally (lives in n8n vault) — fine, n8n will exercise it');
else {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${encodeURIComponent(process.env.GOOGLE_API_KEY)}`;
  const body = {
    model: 'models/gemini-embedding-001',
    content: { parts: [{ text: 'What is the cap rate on this deal?' }] },
    taskType: 'RETRIEVAL_QUERY',
    outputDimensionality: 1536,
  };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) fail(`Gemini returned ${res.status}`, (await res.text()).slice(0, 200));
    else {
      const data = await res.json();
      const dim = data?.embedding?.values?.length;
      if (dim !== 1536) fail(`Gemini returned ${dim} dims; expected 1536`);
      else pass('Gemini returned a 1536-d vector (RETRIEVAL_QUERY task_type honored)');
    }
  } catch (e) { fail('Gemini fetch threw', e.message); }
}

// ─── 5. Cohere (optional) ───────────────────────────────────────────────────
step('Cohere — rerank-v3.5');
if (!process.env.COHERE_API_KEY) skip('COHERE_API_KEY not set locally — n8n / Vercel will exercise it');
else {
  try {
    const res = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.COHERE_API_KEY}` },
      body: JSON.stringify({
        model: 'rerank-v3.5', query: 'environmental contamination',
        documents: ['cap rate on deal', 'phase one esa tce contamination on parcel', 'tenant lease end date'],
        top_n: 2,
      }),
    });
    if (!res.ok) fail(`Cohere rerank returned ${res.status}`, (await res.text()).slice(0, 200));
    else {
      const data = await res.json();
      if (!Array.isArray(data?.results) || data.results.length === 0) fail('Cohere returned no results');
      else pass(`Cohere reranked ${data.results.length} candidates; top idx=${data.results[0].index}`);
    }
  } catch (e) { fail('Cohere fetch threw', e.message); }
}

// ─── 6. Anthropic (optional) ────────────────────────────────────────────────
step('Anthropic — claude-haiku-4-5 ping');
if (!process.env.ANTHROPIC_API_KEY) skip('ANTHROPIC_API_KEY not set locally — n8n vault holds it');
else {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      }),
    });
    if (!res.ok) fail(`Anthropic returned ${res.status}`, (await res.text()).slice(0, 200));
    else {
      const data = await res.json();
      pass(`Anthropic Haiku responded (${data?.usage?.input_tokens ?? 0} in / ${data?.usage?.output_tokens ?? 0} out tokens)`);
    }
  } catch (e) { fail('Anthropic fetch threw', e.message); }
}

// ─── 7. Optional: kick the n8n ingestion webhook for one real doc ───────────
step('n8n — deal-document-ingestion webhook (optional)');
if (!args['doc-id']) {
  skip('pass --doc-id <uuid> [--deal-id <uuid>] to fire the workflow against a real document');
} else if (!process.env.N8N_BASE_URL) {
  skip('N8N_BASE_URL not set');
} else {
  const docId = args['doc-id'];
  let dealId = args['deal-id'];
  if (!dealId) {
    const { data: doc, error } = await admin
      .from('terminal_dd_documents').select('deal_id').eq('id', docId).maybeSingle();
    if (error || !doc) fail(`Could not look up deal_id for document ${docId}`, error?.message);
    else { dealId = doc.deal_id; info(`Resolved deal_id ${dealId} from terminal_dd_documents`); }
  }
  if (dealId) {
    const url = `${process.env.N8N_BASE_URL.replace(/\/+$/, '')}/webhook/deal-document-ingest`;
    info(`POST ${url}`);
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: docId, deal_id: dealId }),
      });
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      const text = await res.text();
      if (!res.ok) fail(`n8n returned ${res.status} after ${dt}s`, text.slice(0, 300));
      else { pass(`n8n responded ${res.status} after ${dt}s`); info(text.slice(0, 300)); }

      const { count } = await admin
        .from('terminal_doc_chunks').select('id', { count: 'exact', head: true })
        .eq('document_id', docId);
      if (count && count > 0) pass(`terminal_doc_chunks has ${count} row(s) for document ${docId}`);
      else fail('terminal_doc_chunks has 0 rows for that document — workflow didn\'t reach the RPC');

      const { data: docRow } = await admin
        .from('terminal_dd_documents').select('indexed_at').eq('id', docId).maybeSingle();
      if (docRow?.indexed_at) pass(`terminal_dd_documents.indexed_at = ${docRow.indexed_at}`);
      else fail('terminal_dd_documents.indexed_at is null — workflow stopped before the RPC');
    } catch (e) {
      fail('n8n webhook fetch threw', e.message);
    }
  }
}

// ─── final ──────────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log(`${C.green}${C.bold}All required checks passed.${C.reset}`);
  process.exit(0);
} else {
  console.log(`${C.red}${C.bold}${failures} check(s) failed.${C.reset}`);
  process.exit(1);
}
