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

export interface TerminalUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  language_preference: Locale;
  company_name: string | null;
  phone: string | null;
  is_active: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TerminalInviteToken {
  id: string;
  email: string;
  role: 'investor' | 'employee';
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface TerminalDeal {
  id: string;
  name: string;
  city: string;
  state: string;
  property_type: string;
  square_footage: string | null;
  units: string | null;
  class_type: string | null;
  year_built: number | null;
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
  special_terms: string;
  assignment_fee: string;
  assignment_irr: string | null;
  gplp_irr: string | null;
  acq_fee: string;
  asset_mgmt_fee: string;
  gp_carry: string;
  loan_fee: string;
  dd_deadline: string | null;
  close_deadline: string | null;
  extension_deadline: string | null;
  psa_draft_start: string | null;
  loi_signed_at: string | null;
  teaser_description: string | null;
  status: DealStatus;
  neighborhood: string | null;
  metro_population: string | null;
  job_growth: string | null;
  investment_highlights: string[] | null;
  acquisition_thesis: string | null;
  quarter_release: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface TerminalDealPhoto {
  id: string;
  deal_id: string;
  storage_path: string;
  display_order: number;
  caption: string | null;
  created_at: string;
}

export interface TerminalDDFolder {
  id: string;
  deal_id: string;
  name: string;
  icon: string | null;
  display_order: number;
}

export interface TerminalDDDocument {
  id: string;
  folder_id: string;
  deal_id: string;
  name: string;
  file_size: string | null;
  file_type: string | null;
  storage_path: string | null;
  is_verified: boolean;
  uploaded_by: string | null;
  created_at: string;
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
  value: unknown;
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
  is_verified: boolean;
  created_at: string;
}

export interface TerminalDealMessage {
  id: string;
  deal_id: string;
  user_id: string;
  message: string;
  created_at: string;
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
