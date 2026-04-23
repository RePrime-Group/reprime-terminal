// Read-only audit for the upcoming is_portfolio / address backfill migration.
// Runs entirely against production data with the service role key.
// Writes NOTHING. Prints exactly what the migration would do and any risks.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const EXCEPTION_PORTFOLIO_ID = '00173b9d-14af-42e9-ab4d-91f59b16c5cc';

function section(title) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
}

async function main() {
  // 1. All deals + their om_storage_path
  const { data: deals, error: dealsErr } = await supabase
    .from('terminal_deals')
    .select('id, name, status, om_storage_path, city, state');
  if (dealsErr) throw dealsErr;

  // 2. All addresses
  const { data: addresses, error: addrErr } = await supabase
    .from('terminal_deal_addresses')
    .select('id, deal_id, label, address, city, state, om_storage_path');
  if (addrErr) throw addrErr;

  // 3. All folders + photos that reference an address_id (for CASCADE blast radius)
  const { data: folders, error: fErr } = await supabase
    .from('terminal_dd_folders')
    .select('id, deal_id, address_id, name');
  if (fErr) throw fErr;

  const { data: photos, error: pErr } = await supabase
    .from('terminal_deal_photos')
    .select('id, deal_id, address_id, storage_path');
  if (pErr) throw pErr;

  // 4. DD documents that live in address-scoped folders
  const folderIdsWithAddress = folders.filter((f) => f.address_id).map((f) => f.id);
  let ddDocsInAddressFolders = [];
  if (folderIdsWithAddress.length > 0) {
    const { data: docs, error: dErr } = await supabase
      .from('terminal_dd_documents')
      .select('id, deal_id, folder_id, name')
      .in('folder_id', folderIdsWithAddress);
    if (dErr) throw dErr;
    ddDocsInAddressFolders = docs || [];
  }

  // Bucket deals by address count
  const addrCountByDeal = new Map();
  for (const a of addresses) {
    addrCountByDeal.set(a.deal_id, (addrCountByDeal.get(a.deal_id) || 0) + 1);
  }

  const zero = [];
  const one = [];
  const many = [];
  for (const d of deals) {
    const n = addrCountByDeal.get(d.id) || 0;
    if (n === 0) zero.push(d);
    else if (n === 1) one.push(d);
    else many.push({ ...d, _addrCount: n });
  }

  section('OVERVIEW');
  console.log(`Total deals:                        ${deals.length}`);
  console.log(`  with 0 addresses (single-prop):   ${zero.length}`);
  console.log(`  with 1 address  (misfiled?):      ${one.length}`);
  console.log(`  with 2+ addresses (true portfolio): ${many.length}`);
  console.log(`Total address rows:                 ${addresses.length}`);
  console.log(`Address-scoped folders:             ${folders.filter((f) => f.address_id).length}`);
  console.log(`Address-scoped photos:              ${photos.filter((p) => p.address_id).length}`);
  console.log(`DD docs inside address-scoped folders: ${ddDocsInAddressFolders.length}`);

  section('EXCEPTION: 00173b9d-14af-42e9-ab4d-91f59b16c5cc');
  const exception = deals.find((d) => d.id === EXCEPTION_PORTFOLIO_ID);
  const exceptionAddrs = addresses.filter((a) => a.deal_id === EXCEPTION_PORTFOLIO_ID);
  if (!exception) {
    console.log('  NOT FOUND — this deal does not exist.');
  } else {
    console.log(`  name:    ${exception.name}`);
    console.log(`  status:  ${exception.status}`);
    console.log(`  deal.om_storage_path: ${exception.om_storage_path || '(null)'}`);
    console.log(`  addresses (${exceptionAddrs.length}):`);
    for (const a of exceptionAddrs) {
      console.log(`    - [${a.id}] "${a.label}" | addr=${a.address || '∅'} | om=${a.om_storage_path ? 'yes' : 'no'}`);
    }
    console.log('  -> Must be force-flagged is_portfolio = true despite having only 1 address row.');
  }

  section('BUCKET: 1 address (candidates for backfill into terminal_deals + DELETE of address row)');
  console.log(`Count: ${one.length} (exception excluded below)\n`);
  let dangerRows = 0;
  for (const d of one) {
    if (d.id === EXCEPTION_PORTFOLIO_ID) continue;
    const [a] = addresses.filter((x) => x.deal_id === d.id);
    const depFolders = folders.filter((f) => f.address_id === a.id);
    const depPhotos = photos.filter((p) => p.address_id === a.id);
    const depDocs = ddDocsInAddressFolders.filter((dc) =>
      depFolders.some((f) => f.id === dc.folder_id)
    );
    const dealOmSet = !!d.om_storage_path;
    const addrOmSet = !!a.om_storage_path;
    const conflict = dealOmSet && addrOmSet && d.om_storage_path !== a.om_storage_path;

    const flags = [];
    if (conflict) flags.push('OM_CONFLICT');
    if (depFolders.length) flags.push(`${depFolders.length}_FOLDERS`);
    if (depPhotos.length) flags.push(`${depPhotos.length}_PHOTOS`);
    if (depDocs.length) flags.push(`${depDocs.length}_DOCS`);
    if (flags.length) dangerRows++;

    console.log(`  deal ${d.id} "${d.name}" (${d.status})`);
    console.log(`    addr_row=${a.id} label="${a.label}" street="${a.address || ''}"`);
    console.log(`    deal.om=${dealOmSet ? 'set' : '—'}   addr.om=${addrOmSet ? 'set' : '—'}`);
    if (flags.length) console.log(`    !! FLAGS: ${flags.join(', ')}`);
    if (conflict) {
      console.log(`       deal.om_storage_path: ${d.om_storage_path}`);
      console.log(`       addr.om_storage_path: ${a.om_storage_path}`);
    }
    if (depFolders.length) {
      for (const f of depFolders) console.log(`       folder "${f.name}" (${f.id})`);
    }
    if (depPhotos.length) {
      for (const p of depPhotos) console.log(`       photo ${p.id}`);
    }
  }
  console.log(`\n  ROWS WITH RISK FLAGS: ${dangerRows}`);

  section('BUCKET: 2+ addresses (real portfolios — is_portfolio=true, no data lift, no delete)');
  for (const d of many) {
    console.log(`  deal ${d.id} "${d.name}" (${d.status}) — ${d._addrCount} addresses, deal.om=${d.om_storage_path ? 'set' : '—'}`);
  }

  section('BUCKET: 0 addresses (already single-property, nothing to migrate)');
  console.log(`Count: ${zero.length}`);

  section('MIGRATION PREVIEW (what the SQL would do)');
  const willFlagPortfolio = [...many.map((d) => d.id)];
  if (exception) willFlagPortfolio.push(EXCEPTION_PORTFOLIO_ID);
  console.log(`UPDATE terminal_deals SET is_portfolio=true  -> ${willFlagPortfolio.length} rows`);
  const willBackfill = one.filter((d) => d.id !== EXCEPTION_PORTFOLIO_ID);
  console.log(`UPDATE terminal_deals SET address/om from address row -> ${willBackfill.length} rows`);
  console.log(`DELETE FROM terminal_deal_addresses (1-addr deals, except exception) -> ${willBackfill.length} rows`);
  console.log(`\nAny row listed with FLAGS above needs manual handling before DELETE.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
