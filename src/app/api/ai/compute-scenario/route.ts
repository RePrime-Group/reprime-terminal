import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  calculateDeal,
  parseDealInputs,
  type DealInputs,
  type DealMetrics,
} from '@/lib/utils/deal-calculator';

export const maxDuration = 30;

type ScenarioType = 'cap_rate' | 'noi' | 'cash_on_cash' | 'dscr' | 'full_underwrite';

interface ScenarioAssumptions {
  // The LLM may send either decimals (0.08) or whole percents (8). We normalize to percent.
  vacancy_rate?: number;
  ltv?: number;
  interest_rate?: number;
  exit_cap_rate?: number;
  hold_years?: number;
  rent_growth?: number;
}

interface ScenarioRequest {
  deal_id: string;
  scenario_type?: ScenarioType;
  assumptions?: ScenarioAssumptions;
}

const VALID_TYPES: ScenarioType[] = ['cap_rate', 'noi', 'cash_on_cash', 'dscr', 'full_underwrite'];

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Treat values <= 1 as decimal fractions (0.08 → 8%); values > 1 as already-percents.
function toPercent(v: number | undefined): number | undefined {
  if (v == null || !Number.isFinite(v)) return undefined;
  return v <= 1 ? v * 100 : v;
}

export async function POST(request: NextRequest) {
  const expected = process.env.N8N_INTERNAL_TOKEN;
  if (!expected) return jsonError('Internal token not configured.', 503);
  const provided = request.headers.get('x-internal-token');
  if (provided !== expected) return jsonError('Unauthorized.', 401);

  let body: ScenarioRequest;
  try {
    body = (await request.json()) as ScenarioRequest;
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  if (!body.deal_id) return jsonError('deal_id is required.', 400);

  const scenario_type: ScenarioType = body.scenario_type && VALID_TYPES.includes(body.scenario_type)
    ? body.scenario_type
    : 'full_underwrite';

  const assumptions = body.assumptions ?? {};

  const admin = createAdminClient();
  const { data: deal, error } = await admin
    .from('terminal_deals')
    .select('*')
    .eq('id', body.deal_id)
    .maybeSingle();

  if (error) return jsonError(`Deal lookup failed: ${error.message}`, 500);
  if (!deal) return jsonError('Deal not found.', 404);

  // Build inputs from the deal record, then apply user-supplied overrides.
  const baseInputs = parseDealInputs(deal as Record<string, unknown>);

  const ltvPct = toPercent(assumptions.ltv);
  const interestPct = toPercent(assumptions.interest_rate);
  const exitCapPct = toPercent(assumptions.exit_cap_rate);
  const rentGrowthPct = toPercent(assumptions.rent_growth);
  const vacancyPct = toPercent(assumptions.vacancy_rate);

  // Vacancy override haircuts NOI directly (deal record already stores stabilized NOI).
  const adjustedNOI = vacancyPct != null
    ? baseInputs.noi * (1 - vacancyPct / 100)
    : baseInputs.noi;

  const inputs: DealInputs = {
    ...baseInputs,
    noi: adjustedNOI,
    ...(ltvPct != null && { ltv: ltvPct }),
    ...(interestPct != null && { interestRate: interestPct }),
    ...(exitCapPct != null && { exitCapRate: exitCapPct }),
    ...(rentGrowthPct != null && { rentGrowth: rentGrowthPct }),
    ...(assumptions.hold_years != null && Number.isFinite(assumptions.hold_years) && {
      holdPeriodYears: assumptions.hold_years,
    }),
  };

  const metrics = calculateDeal(inputs);

  const dealName = (deal as { name?: string }).name ?? null;
  const result = projectScenario(scenario_type, metrics, inputs);

  return NextResponse.json({
    scenario_type,
    deal_id: body.deal_id,
    deal_name: dealName,
    assumptions_applied: {
      vacancy_rate_pct: vacancyPct ?? null,
      ltv_pct: inputs.ltv,
      interest_rate_pct: inputs.interestRate,
      exit_cap_rate_pct: inputs.exitCapRate,
      hold_years: inputs.holdPeriodYears,
      rent_growth_pct: inputs.rentGrowth ?? 0,
    },
    ...result,
  });
}

function projectScenario(
  type: ScenarioType,
  m: DealMetrics,
  inputs: DealInputs,
): Record<string, unknown> {
  switch (type) {
    case 'cap_rate':
      return {
        cap_rate_pct: m.capRate,
        noi: inputs.noi,
        net_basis: m.netBasis,
        purchase_price: inputs.purchasePrice,
      };
    case 'noi':
      return {
        noi: inputs.noi,
        adjusted_noi: m.adjustedNOI,
        capex: m.capex,
      };
    case 'cash_on_cash':
      return {
        cash_on_cash_pct: m.cocReturn,
        distributable_cash_flow: m.distributableCashFlow,
        net_equity: m.netEquity,
        annual_senior_ds: m.headlineSeniorDS,
        annual_mezz_ds: m.annualMezzPayment,
        noi: inputs.noi,
      };
    case 'dscr':
      return {
        lender_dscr: m.lenderDSCR,
        combined_dscr: m.combinedDSCR,
        noi: inputs.noi,
        annual_senior_ds: m.headlineSeniorDS,
        annual_mezz_ds: m.annualMezzPayment,
      };
    case 'full_underwrite':
    default:
      return {
        purchase_price: inputs.purchasePrice,
        net_basis: m.netBasis,
        noi: inputs.noi,
        cap_rate_pct: m.capRate,
        loan_amount: m.loanAmount,
        net_equity: m.netEquity,
        annual_senior_ds: m.headlineSeniorDS,
        distributable_cash_flow: m.distributableCashFlow,
        cash_on_cash_pct: m.cocReturn,
        lender_dscr: m.lenderDSCR,
        combined_dscr: m.combinedDSCR,
        irr_pct: m.irr,
        equity_multiple: m.equityMultiple,
        exit_price: m.exitPrice,
        net_sale_proceeds: m.netSaleProceeds,
        hold_period_years: inputs.holdPeriodYears,
        warnings: m.warnings,
      };
  }
}
