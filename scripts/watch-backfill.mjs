#!/usr/bin/env node
/**
 * Live backfill monitor — read-only. Polls terminal_dd_documents for one deal
 * every few seconds and prints a status table so you can watch the backfill
 * progress in real time: what's processing, what succeeded, what failed and why.
 *
 * Usage:
 *   node --env-file=.env.local scripts/watch-backfill.mjs [deal_id]
 *
 * Defaults to the current test deal if no deal_id is passed.
 * Polls until nothing is left pending/processing, then prints a final summary.
 * Ctrl+C to stop early.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const DEAL_ID = process.argv[2] || '818fc699-0ee6-49a1-8bed-9a32f931cc99';
const POLL_MS = 5_000;

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`Missing env var: ${name}`); process.exit(1); }
  return v;
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const ICON = {
  succeeded: `${c.green}✓${c.reset}`,
  failed: `${c.red}✗${c.reset}`,
  processing: `${c.yellow}⟳${c.reset}`,
  pending: `${c.gray}·${c.reset}`,
};
// processing first (active), then pending (queued), then failed, then succeeded
const ORDER = { processing: 0, pending: 1, failed: 2, succeeded: 3 };

const trunc = (s, n) => {
  if (!s) return '';
  const oneLine = String(s).replace(/\s+/g, ' ').trim();
  return oneLine.length > n ? oneLine.slice(0, n - 1) + '…' : oneLine;
};

let ticks = 0;

async function poll() {
  const { data, error } = await admin
    .from('terminal_dd_documents')
    .select('id, name, indexing_status, attempts, last_error')
    .eq('deal_id', DEAL_ID);

  if (error) {
    console.error(`${c.red}Query failed:${c.reset} ${error.message}`);
    return { done: false };
  }

  const rows = (data || []).slice().sort((a, b) => {
    const o = (ORDER[a.indexing_status] ?? 9) - (ORDER[b.indexing_status] ?? 9);
    return o !== 0 ? o : (a.name || '').localeCompare(b.name || '');
  });

  const counts = { pending: 0, processing: 0, succeeded: 0, failed: 0 };
  for (const r of rows) counts[r.indexing_status] = (counts[r.indexing_status] || 0) + 1;

  // Clear screen + redraw
  process.stdout.write('\x1b[2J\x1b[H');
  ticks += 1;
  console.log(`${c.bold}${c.cyan}Backfill monitor${c.reset}  ${c.dim}deal ${DEAL_ID}${c.reset}`);
  console.log(`${c.dim}${new Date().toLocaleTimeString()}  ·  tick ${ticks}  ·  refresh ${POLL_MS / 1000}s  ·  Ctrl+C to stop${c.reset}`);
  console.log(
    `${c.bold}total ${rows.length}${c.reset}   ` +
    `${ICON.processing} processing ${counts.processing}   ` +
    `${ICON.pending} pending ${counts.pending}   ` +
    `${c.green}✓ succeeded ${counts.succeeded}${c.reset}   ` +
    `${c.red}✗ failed ${counts.failed}${c.reset}`
  );
  console.log(c.dim + '─'.repeat(110) + c.reset);

  for (const r of rows) {
    const icon = ICON[r.indexing_status] || '?';
    const name = trunc(r.name, 42).padEnd(42);
    const att = `a${r.attempts ?? 0}`.padEnd(3);
    const err = r.indexing_status === 'failed' ? `${c.red}${trunc(r.last_error, 55)}${c.reset}` : '';
    console.log(`${icon} ${name} ${c.dim}${att}${c.reset} ${err}`);
  }

  const done = rows.length > 0 && counts.pending === 0 && counts.processing === 0;
  return { done, counts, total: rows.length };
}

console.log('Starting monitor…');
while (true) {
  const { done, counts, total } = await poll();
  if (done) {
    console.log(c.dim + '─'.repeat(110) + c.reset);
    console.log(`${c.bold}Done — nothing left pending/processing.${c.reset}`);
    console.log(`${total} docs:  ${c.green}${counts.succeeded} succeeded${c.reset}  ·  ${c.red}${counts.failed} failed${c.reset}`);
    if (counts.failed > 0) {
      console.log(`${c.dim}Failed docs are parked (attempts maxed). Inspect last_error above, fix root cause, reset via SQL to retry.${c.reset}`);
    }
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
