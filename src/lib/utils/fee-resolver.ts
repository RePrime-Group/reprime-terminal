import type { SupabaseClient } from '@supabase/supabase-js';

export interface FeeDefaults {
  assignmentFee: number;
  acqFee: number;
  assetMgmtFee: number;
  gpCarry: number;
  prefReturn: number;
}

export const REPRIME_STANDARD_FEES: FeeDefaults = {
  assignmentFee: 3,
  acqFee: 2,
  assetMgmtFee: 1.5,
  gpCarry: 20,
  prefReturn: 8,
};

export function resolveFeeSetting(
  dealValue: string | number | null | undefined,
  globalDefault: number,
): number {
  if (dealValue === null || dealValue === undefined) return globalDefault;
  if (typeof dealValue === 'number') {
    return Number.isFinite(dealValue) ? dealValue : globalDefault;
  }
  const trimmed = dealValue.trim();
  if (trimmed === '') return globalDefault;
  const parsed = parseFloat(trimmed);
  return Number.isNaN(parsed) ? globalDefault : parsed;
}

export function resolveAllFees(
  deal: Record<string, unknown>,
  globals: FeeDefaults,
): FeeDefaults {
  return {
    assignmentFee: resolveFeeSetting(
      deal.assignment_fee as string | null | undefined,
      globals.assignmentFee,
    ),
    acqFee: resolveFeeSetting(
      deal.acq_fee as string | null | undefined,
      globals.acqFee,
    ),
    assetMgmtFee: resolveFeeSetting(
      deal.asset_mgmt_fee as string | null | undefined,
      globals.assetMgmtFee,
    ),
    gpCarry: resolveFeeSetting(
      deal.gp_carry as string | null | undefined,
      globals.gpCarry,
    ),
    prefReturn: resolveFeeSetting(
      deal.pref_return as string | null | undefined,
      globals.prefReturn,
    ),
  };
}

const FEE_KEYS = [
  'default_assignment_fee',
  'default_acq_fee',
  'default_asset_mgmt_fee',
  'default_gp_carry',
  'default_pref_return',
] as const;

export async function getGlobalFeeDefaults(
  supabase: SupabaseClient,
): Promise<FeeDefaults> {
  const { data } = await supabase
    .from('terminal_settings')
    .select('key, value')
    .in('key', FEE_KEYS as unknown as string[]);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row?.key) map[row.key as string] = String(row.value ?? '');
  }

  const pick = (key: string, fallback: number): number => {
    const raw = map[key];
    if (!raw) return fallback;
    const parsed = parseFloat(raw);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  return {
    assignmentFee: pick('default_assignment_fee', REPRIME_STANDARD_FEES.assignmentFee),
    acqFee: pick('default_acq_fee', REPRIME_STANDARD_FEES.acqFee),
    assetMgmtFee: pick('default_asset_mgmt_fee', REPRIME_STANDARD_FEES.assetMgmtFee),
    gpCarry: pick('default_gp_carry', REPRIME_STANDARD_FEES.gpCarry),
    prefReturn: pick('default_pref_return', REPRIME_STANDARD_FEES.prefReturn),
  };
}

export interface InvestorTerms {
  assignment_fee?: string | null;
  acq_fee?: string | null;
  asset_mgmt_fee?: string | null;
  gp_carry?: string | null;
  pref_return?: string | null;
}

export function resolveInvestorTerms(
  investor: InvestorTerms | null | undefined,
  globals: FeeDefaults,
): FeeDefaults {
  if (!investor) return { ...globals };
  return {
    assignmentFee: resolveFeeSetting(investor.assignment_fee, globals.assignmentFee),
    acqFee: resolveFeeSetting(investor.acq_fee, globals.acqFee),
    assetMgmtFee: resolveFeeSetting(investor.asset_mgmt_fee, globals.assetMgmtFee),
    gpCarry: resolveFeeSetting(investor.gp_carry, globals.gpCarry),
    prefReturn: resolveFeeSetting(investor.pref_return, globals.prefReturn),
  };
}
