/**
 * One-time script: Recalculate and update stored metrics for all deals.
 *
 * Usage:
 *   npx tsx updateDealMetrics.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { parseDealInputs, calculateDeal } from './src/lib/utils/deal-calculator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: deals, error } = await supabase
    .from('terminal_deals')
    .select('*');

  if (error) {
    console.error('Failed to fetch deals:', error.message);
    process.exit(1);
  }

  if (!deals || deals.length === 0) {
    console.log('No deals found.');
    return;
  }

  console.log(`Found ${deals.length} deal(s). Recalculating...\n`);

  let updated = 0;
  let failed = 0;

  for (const deal of deals) {
    const inputs = parseDealInputs(deal as unknown as Record<string, unknown>);
    const metrics = calculateDeal(inputs);

    const { error: updateError } = await supabase
      .from('terminal_deals')
      .update({
        cap_rate: metrics.capRate > 0 ? metrics.capRate.toFixed(2) : null,
        irr: metrics.irr !== null ? metrics.irr.toFixed(2) : null,
        coc: metrics.cocReturn !== 0 ? metrics.cocReturn.toFixed(2) : null,
        dscr: metrics.combinedDSCR > 0 ? metrics.combinedDSCR.toFixed(2) : null,
        equity_required: metrics.netEquity > 0 ? String(Math.round(metrics.netEquity)) : null,
        loan_estimate: metrics.loanAmount > 0 ? String(Math.round(metrics.loanAmount)) : null,
      })
      .eq('id', deal.id);

    if (updateError) {
      console.error(`  ✗ ${deal.name} (${deal.id}): ${updateError.message}`);
      failed++;
    } else {
      console.log(`  ✓ ${deal.name} — cap ${metrics.capRate.toFixed(2)}% | irr ${metrics.irr?.toFixed(2) ?? '—'}% | coc ${metrics.cocReturn.toFixed(2)}% | dscr ${metrics.combinedDSCR.toFixed(2)}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
}

main();
