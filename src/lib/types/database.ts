export type UserRole = 'owner' | 'employee' | 'investor';
export type DealStatus = 'draft' | 'coming_soon' | 'loi_signed' | 'published' | 'under_review' | 'assigned' | 'closed';
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type Locale = 'en' | 'he';
export type ActivityAction =
  | 'deal_viewed'
  | 'document_downloaded'
  | 'dataroom_viewed'
  | 'structure_viewed'
  | 'irr_calculator_used'
  | 'meeting_requested'
  | 'page_time'
  | 'expressed_interest'
  | 'om_downloaded'
  | 'portal_viewed';

export type TeamPermissionKey =
  | 'view_deals'
  | 'manage_watchlist'
  | 'commit_withdraw'
  | 'download_documents'
  | 'schedule_meetings';

export type TeamPermissions = Partial<Record<TeamPermissionKey, boolean>>;

export interface TerminalUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  language_preference: Locale;
  company_name: string | null;
  phone: string | null;
  is_active: boolean;
  onboarding_completed: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
  parent_investor_id: string | null;
  permissions: TeamPermissions;
  team_invite_limit: number;
}

export interface TerminalInviteToken {
  id: string;
  email: string;
  role: 'investor' | 'employee' | 'team_member';
  token: string;
  invited_by: string | null;
  parent_investor_id: string | null;
  permissions: TeamPermissions | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface TerminalTeamRequest {
  id: string;
  investor_id: string;
  request_type: 'invite_limit' | 'permission';
  requested_total: number | null;
  target_user_id: string | null;
  permission_key: TeamPermissionKey | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

export interface TerminalDeal {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string | null;
  is_portfolio: boolean;
  property_type: string;
  square_footage: string | null;
  units: string | null;
  class_type: string | null;
  year_built: number | null;
  year_renovated: string | null;
  occupancy: string | null;
  purchase_price: string;
  noi: string | null;
  cap_rate: string | null;
  irr: string | null;
  coc: string | null;
  dscr: string | null;
  equity_required: string | null;
  loan_estimate: string | null;
  seller_financing: boolean;
  note_sale: boolean;
  special_terms: string;
  assignment_fee: string | null;
  assignment_irr: string | null;
  gplp_irr: string | null;
  acq_fee: string | null;
  asset_mgmt_fee: string | null;
  gp_carry: string | null;
  loan_fee: string;
  dd_deadline: string | null;
  close_deadline: string | null;
  extension_deadline: string | null;
  timeline_note: string | null;
  psa_draft_start: string | null;
  loi_signed_at: string | null;
  teaser_description: string | null;
  deposit_amount: string | null;
  deposit_held_by: string | null;
  om_storage_path: string | null;
  loi_signed_storage_path: string | null;
  psa_storage_path: string | null;
  full_report_storage_path: string | null;
  costar_report_storage_path: string | null;
  tenants_report_storage_path: string | null;
  lease_summary_storage_path: string | null;
  // Senior Debt
  ltv: string | null;
  interest_rate: string | null;
  amortization_years: string | null;
  loan_fee_points: string | null;
  io_period_months: string | null;
  // Mezzanine
  mezz_percent: string | null;
  mezz_rate: string | null;
  mezz_term_months: string | null;
  // Credits & Fees
  seller_credit: string | null;
  pref_return: string | null;
  // Market benchmarks
  area_cap_rate: string | null;
  asking_cap_rate: string | null;
  // Hold/Exit
  hold_period_years: string | null;
  exit_cap_rate: string | null;
  rent_growth: string | null;
  legal_title_estimate: string | null;
  disposition_cost_pct: string | null;
  capex: string | null;
  capex_narrative: string | null;
  debt_terms_quoted: boolean;
  status: DealStatus;
  neighborhood: string | null;
  metro_population: string | null;
  job_growth: string | null;
  investment_highlights: string[] | null;
  acquisition_thesis: string | null;
  quarter_release: string | null;
  created_by: string | null;
  assigned_to: string | null;
  // Tab visibility toggles
  show_rent_roll: boolean;
  show_capex: boolean;
  show_exit_strategy: boolean;
  // Cached computed value for portal card display
  computed_walt: string | null;
  created_at: string;
  updated_at: string;
}

export type LeaseType = 'NNN' | 'NN' | 'Modified Gross' | 'Gross' | 'Ground';
export type LeaseStatus = 'Active' | 'Expired' | 'Month-to-Month' | 'In Negotiation';
export type TenantCreditRating = 'Investment Grade' | 'National Credit' | 'Regional' | 'Local' | 'Unknown';

export interface TerminalTenantLease {
  id: string;
  deal_id: string;
  address_id: string | null;
  tenant_name: string;
  suite_unit: string | null;
  leased_sf: number | null;
  annual_base_rent: string | null;
  rent_per_sf: string | null;
  lease_type: LeaseType;
  lease_start_date: string | null;
  lease_end_date: string | null;
  rent_commencement_date: string | null;
  option_renewals: string | null;
  escalation_structure: string | null;
  cam_reimbursement: string | null;
  tax_reimbursement: string | null;
  insurance_reimbursement: string | null;
  percentage_rent: string | null;
  security_deposit: string | null;
  guarantor: string | null;
  tenant_credit_rating: TenantCreditRating | null;
  tenant_industry: string | null;
  is_anchor: boolean;
  is_vacant: boolean;
  market_rent_estimate: string | null;
  notes: string | null;
  status: LeaseStatus;
  sort_order: number;
  ai_extracted: boolean;
  created_at: string;
  updated_at: string;
}

export interface TerminalDealPhoto {
  id: string;
  deal_id: string;
  storage_path: string;
  display_order: number;
  caption: string | null;
  address_id: string | null;
  created_at: string;
}

export interface TerminalDDFolder {
  id: string;
  deal_id: string;
  name: string;
  icon: string | null;
  display_order: number;
  address_id: string | null;
  parent_id: string | null;
}

export interface TerminalDDDocument {
  id: string;
  folder_id: string;
  deal_id: string;
  name: string;
  display_name: string | null;
  file_size: string | null;
  file_type: string | null;
  storage_path: string | null;
  is_downloadable: boolean;
  doc_status: 'verified' | 'uploaded' | 'pending' | 'requested' | 'notuploaded' | 'doesnotexist' | 'na' | 'notrequired';
  uploaded_by: string | null;
  sort_order: number;
  created_at: string;
}

// Hierarchical tree node used by the data room renderer (admin + investor).
// Built client-side from flat folder + document arrays via buildTree().
export interface DataRoomFolderNode extends TerminalDDFolder {
  children: DataRoomFolderNode[];
  documents: TerminalDDDocument[];
}

export interface TerminalActivityLog {
  id: string;
  user_id: string | null;
  deal_id: string | null;
  action: ActivityAction;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TerminalMeeting {
  id: string;
  deal_id: string | null;
  investor_id: string;
  scheduled_at: string;
  status: MeetingStatus;
  notes: string | null;
  created_at: string;
}

export interface TerminalAvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface TerminalSetting {
  key: string;
  value: string;
  updated_at: string;
}

// Pipeline types
export type PipelineStage = 'post_loi' | 'due_diligence' | 'pre_closing' | 'post_closing';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'blocked';

export interface TerminalDealStage {
  id: string;
  deal_id: string;
  stage: PipelineStage;
  started_at: string | null;
  completed_at: string | null;
  is_current: boolean;
  created_at: string;
}

export interface TerminalDealTask {
  id: string;
  deal_id: string;
  stage: PipelineStage;
  name: string;
  assignee_id: string | null;
  due_days: number | null;
  due_date: string | null;
  due_type: string;
  is_gate: boolean;
  is_milestone: boolean;
  status: TaskStatus;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TerminalTaskAttachment {
  id: string;
  task_id: string;
  deal_id: string;
  name: string;
  file_size: string | null;
  file_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  show_to_investors: boolean;
  investor_folder_id: string | null;
  created_at: string;
}

export interface TerminalDealMessage {
  id: string;
  deal_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export interface TerminalDealAddress {
  id: string;
  deal_id: string;
  label: string;
  address: string | null;
  city: string | null;
  state: string | null;
  square_footage: string | null;
  units: string | null;
  year_built: number | null;
  om_storage_path: string | null;
  display_order: number;
  capex_narrative: string | null;
  created_at: string;
}

export type CapExCondition = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Unknown';
export type CapExPriority = 'Immediate' | 'Near-Term' | 'During Hold' | 'Post-Hold' | 'N/A';

export interface CapExItem {
  id: string;
  deal_id: string;
  address_id: string | null;
  component_name: string;
  current_condition: CapExCondition;
  year_last_replaced: string | null;
  useful_life_remaining: string | null;
  estimated_replacement_cost: string | null;
  priority: CapExPriority;
  notes: string | null;
  sort_order: number;
  ai_extracted: boolean;
  created_at: string;
  updated_at: string;
}

export type ExitScenarioType = 'conservative' | 'moderate' | 'aggressive' | 'refinance';
export type BuyerProfile =
  | 'Value Investor'
  | 'Stabilized Asset Buyer'
  | 'Institutional'
  | 'Net Lease Buyer'
  | '1031 Exchange Buyer'
  | 'Private Equity'
  | 'Local Investor'
  | 'N/A';

export interface ExitRefiParams {
  ltv: number;         // %
  rate: number;        // %
  amortYears: number;  // years
}

export interface ExitScenario {
  id: string;
  deal_id: string;
  scenario_type: ExitScenarioType;
  scenario_name: string;
  exit_year: number;
  exit_cap_rate: string | null;
  exit_noi: string | null;
  additional_capex: string | null;
  strategy_narrative: string | null;
  buyer_profile: BuyerProfile | null;
  market_comps: string | null;
  refi_params: ExitRefiParams | null;
  is_enabled: boolean;
  sort_order: number;
  ai_generated_narrative: boolean;
  created_at: string;
  updated_at: string;
}

export interface TerminalDealSubscription {
  id: string;
  deal_id: string;
  user_id: string;
  created_at: string;
  notified_at: string | null;
}

export interface TerminalNotification {
  id: string;
  user_id: string;
  deal_id: string | null;
  type: string;
  title: string;
  description: string;
  read_at: string | null;
  created_at: string;
}

// Deal with related data for portal display
export interface DealWithPhotos extends TerminalDeal {
  photos: TerminalDealPhoto[];
}

export interface DealWithDetails extends TerminalDeal {
  photos: TerminalDealPhoto[];
  dd_folders: (TerminalDDFolder & { documents: TerminalDDDocument[] })[];
  viewing_count: number;
  meetings_count: number;
}
