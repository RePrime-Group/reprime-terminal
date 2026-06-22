import type { DealStatus } from '@/lib/types/database';

/** One building in a portfolio deal. Mirrors `terminal_deal_addresses` inputs. */
export interface DealCreateAddress {
  label: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  square_footage?: string | null;
  units?: string | null;
}

/**
 * Normalized input accepted by `createDeal` / the bulk importer.
 *
 * Field names mirror `terminal_deals` columns. Derived metrics
 * (cap_rate, irr, coc, dscr, equity_required, loan_estimate) are intentionally
 * omitted — they are computed server-side from purchase_price/noi/debt terms,
 * matching the single-deal form's behavior. Anything supplied for them is ignored.
 */
export interface DealCreateInput {
  name: string;
  property_type: string;
  is_portfolio: boolean;
  address?: string | null;
  city: string;
  state: string;
  square_footage?: string | null;
  units?: string | null;
  class_type?: string | null;
  year_built?: number | string | null;
  year_renovated?: string | null;
  occupancy?: string | null;
  purchase_price: string;
  noi?: string | null;
  seller_financing?: boolean;
  note_sale?: boolean;
  special_terms?: string | null;
  assignment_fee?: string | null;
  assignment_irr?: string | null;
  gplp_irr?: string | null;
  acq_fee?: string | null;
  asset_mgmt_fee?: string | null;
  gp_carry?: string | null;
  loan_fee?: string | null;
  // Senior debt
  ltv?: string | null;
  interest_rate?: string | null;
  amortization_years?: string | null;
  loan_fee_points?: string | null;
  io_period_months?: string | null;
  // Mezzanine
  mezz_percent?: string | null;
  mezz_rate?: string | null;
  mezz_term_months?: string | null;
  // Credits
  seller_credit?: string | null;
  pref_return?: string | null;
  area_cap_rate?: string | null;
  asking_cap_rate?: string | null;
  // Exit
  hold_period_years?: string | null;
  exit_cap_rate?: string | null;
  debt_terms_quoted?: boolean;
  // Timeline
  dd_deadline?: string | null;
  close_deadline?: string | null;
  extension_deadline?: string | null;
  timeline_note?: string | null;
  psa_draft_start?: string | null;
  loi_signed_at?: string | null;
  // Pre-pipeline / marketing
  teaser_description?: string | null;
  deposit_amount?: string | null;
  deposit_held_by?: string | null;
  neighborhood?: string | null;
  metro_population?: string | null;
  job_growth?: string | null;
  quarter_release?: string | null;
  investment_highlights?: string[] | null;
  acquisition_thesis?: string | null;
  // Status + nested records
  status: DealStatus;
  addresses?: DealCreateAddress[];
  tenants?: Record<string, unknown>[];
}
