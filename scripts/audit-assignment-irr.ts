// Audit: Assignment IRR vs GP/LP IRR cash flows for Springfield.
// Pulls the deal from Supabase, runs calculateDeal, and prints every
// intermediate value that feeds IRR for both scenarios.

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  parseDealInputs,
  calculateDeal,
  calculatePropertyMetrics,
  type DealInputs,
} from '../src/lib/utils/deal-calculator';

// Inline .env loader (avoid dotenv dep)
const envPath = path.resolve(__dirname, '..', '.env');
const env: Record<string, string> = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Local IRR solver mirroring the engine's Newton's method solver.
function solveIRR(cashFlows: number[], guess = 0.10, maxIter = 100, tol = 1e-7): number | null {
  if (cashFlows.length < 2) return null;
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += cashFlows[t] / denom;
      if (t > 0) dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(dnpv) < 1e-10) return null;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tol) return newRate * 100;
    rate = newRate;
    if (rate < -0.99 || rate > 10) return null;
  }
  return null;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

async function audit() {
  // Pull Springfield
  const { data, error } = await supabase
    .from('terminal_deals')
    .select('*')
    .ilike('name', '%springfield%')
    .limit(5);
  if (error) {
    console.error('Supabase error:', error);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error('No Springfield deal found.');
    process.exit(1);
  }

  for (const deal of data) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('DEAL:', deal.name);
    console.log('═══════════════════════════════════════════════════════');

    // Raw inputs from DB
    const inputs = parseDealInputs(deal as Record<string, unknown>);
    console.log('\n── INPUTS ──');
    console.log({
      purchasePrice: inputs.purchasePrice,
      noi: inputs.noi,
      ltv: inputs.ltv,
      interestRate: inputs.interestRate,
      amortYears: inputs.amortYears,
      ioPeriodMonths: inputs.ioPeriodMonths,
      sellerFinancing: inputs.sellerFinancing,
      mezzPercent: inputs.mezzPercent,
      mezzRate: inputs.mezzRate,
      sellerCredit: inputs.sellerCredit,
      assignmentFee: inputs.assignmentFee,
      acqFee: inputs.acqFee,
      assetMgmtFee: inputs.assetMgmtFee,
      gpCarry: inputs.gpCarry,
      prefReturn: inputs.prefReturn,
      holdPeriodYears: inputs.holdPeriodYears,
      exitCapRate: inputs.exitCapRate,
      rentGrowth: inputs.rentGrowth,
      legalTitleEstimate: inputs.legalTitleEstimate,
      dispositionCostPct: inputs.dispositionCostPct,
    });

    // Property-level (zero fees) — what the headline metrics show
    const prop = calculatePropertyMetrics(inputs);
    console.log('\n── PROPERTY-LEVEL METRICS (no fees) ──');
    console.log({
      capRate: prop.capRate.toFixed(2) + '%',
      netEquity: fmt(prop.netEquity),
      annualSeniorDS: fmt(prop.annualSeniorDS),
      annualMezzPayment: fmt(prop.annualMezzPayment),
      adjustedNOI: fmt(prop.adjustedNOI),
      distributableCF: fmt(prop.distributableCashFlow),
      cocReturn: prop.cocReturn != null ? prop.cocReturn.toFixed(2) + '%' : 'N/A',
      irr: prop.irr != null ? prop.irr.toFixed(2) + '%' : 'N/A',
      annualCashFlows: prop.annualCashFlows.map(fmt),
      exitPrice: fmt(prop.exitPrice),
      seniorPayoffAtExit: fmt(prop.seniorPayoffAtExit),
      netSaleProceeds: fmt(prop.netSaleProceeds),
    });

    // ──── Apply REPRIME standard fees on top of the deal's stored inputs.
    // This mirrors `feeAdjustedInputs` in DealDetailClient.tsx (line 2271-2281),
    // which overlays effectiveDealFees onto the parsed deal record.
    // REPRIME_STANDARD_FEES from src/lib/utils/fee-resolver.ts:
    //   assignmentFee 3, acqFee 2, assetMgmtFee 1.5, gpCarry 20, prefReturn 8
    const feeAdjustedInputs: DealInputs = {
      ...inputs,
      assignmentFee: 3,
      acqFee: 2,
      assetMgmtFee: 1.5,
      gpCarry: 20,
      prefReturn: 8,
    };
    // Fee-adjusted (the actual values used on Deal Structure cards)
    const fa = calculateDeal(feeAdjustedInputs);
    console.log('\n── FEE-ADJUSTED METRICS (real fees applied) ──');
    console.log({
      netEquity: fmt(fa.netEquity),
      acqFeeDollar: fmt(fa.acqFeeDollar),
      assignmentFeeDollar: fmt(fa.assignmentFeeDollar),
      assetMgmtFeeDollar: fmt(fa.assetMgmtFeeDollar),
      annualCashFlows: fa.annualCashFlows.map(fmt),
      netSaleProceeds: fmt(fa.netSaleProceeds),
      irr: fa.irr != null ? fa.irr.toFixed(2) + '%' : 'N/A',
      assignmentIRR: fa.assignmentIRR != null ? fa.assignmentIRR.toFixed(2) + '%' : 'N/A',
    });

    // ─────────── REBUILD THE EXACT CASH FLOW ARRAYS THE ENGINE USED ───────────
    // (mirroring deal-calculator.ts lines 290-304)
    const annualCashFlows = fa.annualCashFlows;
    const netEquity = fa.netEquity;
    const netSaleProceeds = fa.netSaleProceeds;
    const assignmentFeeDollar = feeAdjustedInputs.purchasePrice * (feeAdjustedInputs.assignmentFee / 100);
    const assignmentEquity = netEquity + assignmentFeeDollar;

    const gpLpFlows = [-netEquity, ...annualCashFlows.slice(0, -1)];
    if (annualCashFlows.length > 0)
      gpLpFlows.push(annualCashFlows[annualCashFlows.length - 1] + netSaleProceeds);

    const assignmentFlows = [-assignmentEquity, ...annualCashFlows.slice(0, -1)];
    if (annualCashFlows.length > 0)
      assignmentFlows.push(annualCashFlows[annualCashFlows.length - 1] + netSaleProceeds);

    console.log('\n── GP/LP IRR CASH FLOWS (current engine) ──');
    gpLpFlows.forEach((cf, i) => console.log(`  Y${i}: ${fmt(cf)}`));
    console.log(`  IRR = ${solveIRR(gpLpFlows)?.toFixed(2)}%`);

    console.log('\n── ASSIGNMENT IRR CASH FLOWS (current engine) ──');
    assignmentFlows.forEach((cf, i) => console.log(`  Y${i}: ${fmt(cf)}`));
    console.log(`  IRR = ${solveIRR(assignmentFlows)?.toFixed(2)}%`);

    // ─────────── HYPOTHETICAL: CORRECT ASSIGNMENT FLOWS ───────────
    // For assignment scenario the operator has no GP/LP fees:
    //   - Year 0 outflow: investor pays for property + assignment fee, NO acq fee, NO loan fee, NO legal/title (or just real third-party costs)
    //   - Annual CF: NOI - DS - mezz (NO AMF)
    //   - Exit: gross sale proceeds (NO GP carry)
    //
    // Two reasonable interpretations:
    //   (A) "pure" — strip ALL sponsor fees, keep only assignment fee
    //   (B) "investor pays loan/legal too" — keep loan fee + legal/title, drop acq fee + AMF + carry
    //
    // We compute both and let the user pick.

    // Property-level (no fees) is the cleanest "no sponsor fees" baseline.
    // Inject the assignment fee on top of property-level equity and use property-level CF + exit.
    const propAssignmentEquity = prop.netEquity + assignmentFeeDollar;
    const propAssignmentFlows = [-propAssignmentEquity, ...prop.annualCashFlows.slice(0, -1)];
    if (prop.annualCashFlows.length > 0)
      propAssignmentFlows.push(prop.annualCashFlows[prop.annualCashFlows.length - 1] + prop.netSaleProceeds);

    console.log('\n── ASSIGNMENT IRR — IF FEES STRIPPED (proposed fix; uses property-level CF + grossSaleProceeds + assignment fee) ──');
    propAssignmentFlows.forEach((cf, i) => console.log(`  Y${i}: ${fmt(cf)}`));
    console.log(`  IRR = ${solveIRR(propAssignmentFlows)?.toFixed(2)}%`);

    // Sanity: bug breakdown — show how each contamination contributes
    console.log('\n── CONTAMINATION OF ASSIGNMENT IRR (current engine) ──');
    console.log('  • acqFee added to Year 0 equity (via netEquity):', fmt(fa.acqFeeDollar));
    console.log('  • AMF deducted from each annual CF:', fmt(fa.assetMgmtFeeDollar) + '/yr');
    // GP carry impact = (netSaleProceeds_property − netSaleProceeds_feeAdjusted)
    const gpCarryDollar = prop.netSaleProceeds - fa.netSaleProceeds;
    console.log('  • GP carry deducted from exit proceeds:', fmt(gpCarryDollar));
  }
  process.exit(0);
}

audit().catch((e) => {
  console.error(e);
  process.exit(1);
});
