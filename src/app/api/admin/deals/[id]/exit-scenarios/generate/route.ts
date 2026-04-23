import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseDealInputs, calculatePropertyMetrics } from '@/lib/utils/deal-calculator';

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only: auto-generate the four default exit scenarios from deal data.
//
// This is the ONE place where the exit-strategy feature touches the engine:
// we call calculatePropertyMetrics once to derive the entry cap rate and the
// starting NOI (so Aggressive/Moderate can grow it). The inserted scenario
// rows are plain numbers — the admin page and investor tab read the scenarios
// as data and never re-import the engine.
//
// Upserts on (deal_id, scenario_type) so calling this twice resets to
// defaults (the admin page exposes this as "Reset to Defaults").
// ─────────────────────────────────────────────────────────────────────────────

interface ScenarioRow {
  deal_id: string;
  scenario_type: 'conservative' | 'moderate' | 'aggressive' | 'refinance';
  scenario_name: string;
  exit_year: number;
  exit_cap_rate: number;
  exit_noi: number;
  additional_capex: number;
  strategy_narrative: string;
  buyer_profile: string | null;
  market_comps: string | null;
  refi_params: { ltv: number; rate: number; amortYears: number } | null;
  is_enabled: boolean;
  sort_order: number;
  ai_generated_narrative: boolean;
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: dealId } = await context.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['owner', 'employee'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: deal } = await admin
    .from('terminal_deals')
    .select('*')
    .eq('id', dealId)
    .single();
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  // Derive entry cap + hold info from the engine so scenarios line up with
  // what the Financial Modeling tab shows. metrics.capRate is the property-
  // level cap (fees zeroed) which matches what investors see on the hero.
  const inputs = parseDealInputs(deal as unknown as Record<string, unknown>);
  const metrics = calculatePropertyMetrics(inputs);
  const entryCapPct = metrics.capRate;
  const holdYears = inputs.holdPeriodYears || 5;
  const noi = inputs.noi;
  // rent growth defaults to 2% per spec when the deal has no value set
  const rentGrowthPct = inputs.rentGrowth && inputs.rentGrowth > 0
    ? inputs.rentGrowth
    : 2;

  const grownNOI = (years: number, growthPct: number) =>
    noi * Math.pow(1 + growthPct / 100, years);

  // Refi year defaults to 3 per spec — grow the NOI to that point using
  // the deal's rent-growth assumption.
  const refiYear = 3;

  const rows: ScenarioRow[] = [
    {
      deal_id: dealId,
      scenario_type: 'conservative',
      scenario_name: 'Conservative — Hold & Collect',
      exit_year: holdYears,
      exit_cap_rate: entryCapPct + 1.5,
      exit_noi: noi,  // flat (0% growth)
      additional_capex: 0,
      strategy_narrative:
        `Hold for ${holdYears} years collecting in-place cash flow. Exit at a conservative cap ` +
        `rate reflecting market softening to a value investor seeking stable yield.`,
      buyer_profile: 'Value Investor',
      market_comps: null,
      refi_params: null,
      is_enabled: true,
      sort_order: 0,
      ai_generated_narrative: false,
    },
    {
      deal_id: dealId,
      scenario_type: 'moderate',
      scenario_name: 'Moderate — Stabilize & Sell',
      exit_year: holdYears,
      exit_cap_rate: entryCapPct + 0.5,
      exit_noi: grownNOI(holdYears, rentGrowthPct),
      additional_capex: 0,
      strategy_narrative:
        `Stabilize in-place income with ${rentGrowthPct.toFixed(1)}% annual rent growth and ` +
        `exit at a modestly expanded cap to a buyer of stabilized cash-flowing assets.`,
      buyer_profile: 'Stabilized Asset Buyer',
      market_comps: null,
      refi_params: null,
      is_enabled: true,
      sort_order: 1,
      ai_generated_narrative: false,
    },
    {
      deal_id: dealId,
      scenario_type: 'aggressive',
      scenario_name: 'Aggressive — Value-Add & Reposition',
      exit_year: holdYears,
      exit_cap_rate: Math.max(0.1, entryCapPct - 0.5),
      exit_noi: noi * 1.15,  // 15% NOI lift placeholder
      additional_capex: 0,   // admin fills in real amount
      strategy_narrative:
        `Reposition the asset through targeted capital improvements and leasing to drive NOI ` +
        `~15% higher than in-place. Exit to an institutional or net-lease buyer at a compressed cap.`,
      buyer_profile: 'Institutional',
      market_comps: null,
      refi_params: null,
      is_enabled: true,
      sort_order: 2,
      ai_generated_narrative: false,
    },
    {
      deal_id: dealId,
      scenario_type: 'refinance',
      scenario_name: 'Refinance — Tax-Free Equity Recapture',
      exit_year: refiYear,
      exit_cap_rate: entryCapPct,  // flat for refi valuation per spec
      exit_noi: grownNOI(refiYear, rentGrowthPct),
      additional_capex: 0,
      strategy_narrative:
        `Refinance in year ${refiYear} at 75% LTV against the grown NOI to return capital to ` +
        `investors tax-free while retaining ownership and upside.`,
      buyer_profile: null,
      market_comps: null,
      refi_params: {
        ltv: 75,
        rate: inputs.interestRate || 6.0,
        amortYears: inputs.amortYears || 30,
      },
      is_enabled: true,
      sort_order: 3,
      ai_generated_narrative: false,
    },
  ];

  const { error } = await admin
    .from('exit_scenarios')
    .upsert(rows, { onConflict: 'deal_id,scenario_type' });

  if (error) {
    return NextResponse.json({ error: `Insert failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, inserted: rows.length });
}
