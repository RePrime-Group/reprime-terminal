export type PipelineStage = 'post_loi' | 'due_diligence' | 'pre_closing' | 'post_closing';
export type TaskDueType = 'after_stage' | 'on_stage' | 'after_listing_executed';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'blocked';

export interface TaskTemplate {
  name: string;
  dueDays: number;
  dueType?: TaskDueType;
  isGate?: boolean;
  isMilestone?: boolean;
  defaultAssignee?: string;
}

export const STAGE_LABELS: Record<PipelineStage, string> = {
  post_loi: 'Post LOI',
  due_diligence: 'Due Diligence',
  pre_closing: 'Pre-Closing',
  post_closing: 'Post-Closing',
};

export const STAGE_DURATIONS: Record<PipelineStage, string> = {
  post_loi: '10 Days',
  due_diligence: '30 Days',
  pre_closing: '30-60 Days',
  post_closing: '7 Days',
};

export const STAGE_ORDER: PipelineStage[] = [
  'post_loi',
  'due_diligence',
  'pre_closing',
  'post_closing',
];

export const DEFAULT_DD_FOLDERS = [
  { name: '01_Marketing', icon: '📢' },
  { name: '02_Market_Research', icon: '📊' },
  { name: '03_Legal', icon: '⚖️' },
  { name: '04_Financials', icon: '💰' },
  { name: '05_Leases', icon: '📋' },
  { name: '06_DD_Reports', icon: '📑' },
  { name: '07_Financing_Lenders', icon: '🏦' },
  { name: '08_Insurance', icon: '🛡️' },
  { name: '09_Presentations', icon: '📽️' },
  { name: '10_Site_Visit', icon: '🏗️' },
  { name: '11_Investor_Materials', icon: '📄' },
  { name: '12_Post_Closing', icon: '✅' },
];

export const POST_LOI_TASKS: TaskTemplate[] = [
  { name: 'Create Data Room Structure', dueDays: 1, dueType: 'after_stage' },
  { name: 'Upload: Original OM', dueDays: 1, dueType: 'after_stage', defaultAssignee: 'Steve Philipp' },
  { name: 'Upload CoStar Reports', dueDays: 1, dueType: 'after_stage', defaultAssignee: 'Chaim Abrahams' },
  { name: 'Upload: LOI (Executed)', dueDays: 1, dueType: 'after_stage', defaultAssignee: 'Steve Philipp' },
  { name: 'Upload: Narrative Analysis', dueDays: 2, dueType: 'after_stage' },
  { name: 'Complete: Hebrew Presentation', dueDays: 2, dueType: 'after_stage', defaultAssignee: 'Adir Yonasi' },
  { name: 'Approved: Hebrew Presentation', dueDays: 5, dueType: 'after_stage', defaultAssignee: 'Gideon Gratsiani' },
  { name: 'Complete: English Presentation', dueDays: 2, dueType: 'after_stage', defaultAssignee: 'Steve Philipp' },
  { name: 'Approve: English Presentation', dueDays: 5, dueType: 'after_stage', defaultAssignee: 'Gideon Gratsiani' },
  { name: 'Complete: Financial Model (Initial)', dueDays: 5, dueType: 'after_stage', defaultAssignee: 'Adir Yonasi' },
  { name: 'Full Team Meeting', dueDays: 6, dueType: 'after_stage', isGate: true, isMilestone: true },
  { name: 'Presentation Gate', dueDays: 6, dueType: 'after_stage', isGate: true },
  { name: 'Release Presentations to LPs', dueDays: 7, dueType: 'after_stage', defaultAssignee: 'Adir Yonasi' },
  { name: 'Draft/Review PSA', dueDays: 2, dueType: 'after_listing_executed', defaultAssignee: 'Chaim Abrahams' },
  { name: 'Verify PSA Contains DD Requirements', dueDays: 5, dueType: 'after_stage' },
  { name: 'Negotiate PSA Terms', dueDays: 7, dueType: 'after_stage' },
  { name: 'Execute PSA', dueDays: 10, dueType: 'after_stage' },
  { name: 'Open Escrow / Deposit Earnest Money', dueDays: 10, dueType: 'after_stage', defaultAssignee: 'Shirel Ben Haroush' },
  { name: 'Send Formal DD Request to Seller', dueDays: 1, dueType: 'after_stage' },
  { name: 'Send DD Request to Outsourced Company', dueDays: 5, dueType: 'after_stage' },
  { name: 'PSA', dueDays: 0, dueType: 'on_stage' },
  { name: 'Financing Options', dueDays: 0, dueType: 'on_stage' },
  { name: 'Site Visit', dueDays: 0, dueType: 'on_stage' },
  { name: 'NOI/Lease Analysis', dueDays: 0, dueType: 'on_stage' },
  { name: 'PCR', dueDays: 0, dueType: 'on_stage' },
];

export const DUE_DILIGENCE_TASKS: TaskTemplate[] = [
  { name: 'DD Clock Officially Starts', dueDays: 0, dueType: 'on_stage' },
  { name: 'Receive Seller DD Package', dueDays: 1, defaultAssignee: 'Chaim Abrahams' },
  { name: 'Upload All Seller Materials to Data Room', dueDays: 2, defaultAssignee: 'Amelia A' },
  { name: 'Cross-Check: All Items from DD List Received', dueDays: 2, defaultAssignee: 'Chaim Abrahams' },
  { name: 'Confirm: All DD Materials Received', dueDays: 2 },
  { name: 'Begin Financial Reunderwriting with Actual Data', dueDays: 3 },
  { name: 'Review All Leases / Rent Roll Verification', dueDays: 5 },
  { name: 'Schedule Site Visit', dueDays: 5 },
  { name: 'Conduct Site Visit', dueDays: 7 },
  { name: 'Upload Site Visit Report + Photos', dueDays: 7 },
  { name: 'Coordinate PCR with Outsourced Company', dueDays: 10, defaultAssignee: 'Chaim Abrahams' },
  { name: 'Update Financial Model with DD Findings', dueDays: 12 },
  { name: 'Internal Update Meeting', dueDays: 7, isMilestone: true },
  { name: 'Receive PCR from Outsourced Company', dueDays: 18 },
  { name: 'Review PCR / Flag Major Issues', dueDays: 19 },
  { name: 'Begin Lender Outreach (Term Sheet Requests)', dueDays: 1, defaultAssignee: 'Chaim Abrahams' },
  { name: 'Lender Selection Meeting', dueDays: 10, isMilestone: true, defaultAssignee: 'Shirel Ben Haroush' },
  { name: 'Collect and Compare Lender Term Sheets', dueDays: 20 },
  { name: 'Internal Update Meeting 2', dueDays: 14, isMilestone: true },
  { name: 'Internal Update Meeting 3', dueDays: 21, isMilestone: true },
  { name: 'Compile DD Findings Summary', dueDays: 23 },
  { name: 'Update Model with Final DD Adjustments', dueDays: 24 },
  { name: 'Prepare Knockdown Strategy', dueDays: 25 },
  { name: 'Schedule Knockdown Meeting', dueDays: 25 },
  { name: 'Present Updated Model to Team', dueDays: 26 },
  { name: 'Final Lender Selection / Lock Terms', dueDays: 26 },
  { name: 'Conduct Knockdown Meeting', dueDays: 28 },
  { name: 'Negotiate Final Terms', dueDays: 29 },
  { name: 'GO/NO-GO Gate (Before Hard Money)', dueDays: 29, isGate: true },
  { name: 'Internal Update Meeting 4', dueDays: 28, isMilestone: true },
  { name: 'Deposit Goes Hard / Notify Escrow', dueDays: 30 },
];

export const PRE_CLOSING_TASKS: TaskTemplate[] = [
  { name: 'Order Title Commitment', dueDays: 1 },
  { name: 'Order ALTA Survey', dueDays: 2 },
  { name: 'Order Phase I Environmental', dueDays: 2 },
  { name: 'Review Phase I Environmental', dueDays: 13 },
  { name: 'Send Tenant Estoppels', dueDays: 5 },
  { name: 'Begin Insurance Shopping', dueDays: 5 },
  { name: 'Receive Title Commitment', dueDays: 10 },
  { name: 'Receive ALTA Survey', dueDays: 12 },
  { name: 'Review Title Exceptions / Object if Needed', dueDays: 13 },
  { name: 'Review Survey for Encroachments', dueDays: 13 },
  { name: 'Receive Estoppel Certificates', dueDays: 15 },
  { name: 'Form Acquisition Entity (LLC/LP)', dueDays: 15 },
  { name: 'Locate & Engage Management Companies', dueDays: 10 },
  { name: 'Prepare LP Capital Call', dueDays: 10 },
  { name: 'Receive Insurance Quotes', dueDays: 15 },
  { name: 'Finalize Loan Documents', dueDays: 20 },
  { name: 'Issue Capital Call to LPs', dueDays: 11 },
  { name: 'Confirm LP Funds Received', dueDays: 22 },
  { name: 'Bind Insurance Policy', dueDays: 22 },
  { name: 'Finalize Property Management Agreement', dueDays: 22 },
  { name: 'Extension Decision Gate', dueDays: 23, isGate: true },
  { name: 'Extension Decision', dueDays: 24 },
  { name: 'Closing Authorization Gate', dueDays: 25, isGate: true },
  { name: 'Review Final Closing Statement', dueDays: 27 },
  { name: 'Wire Funds to Escrow', dueDays: 28 },
  { name: 'Authorize: Proceed to Close', dueDays: 28 },
  { name: 'Execute All Closing Documents', dueDays: 30 },
  { name: 'Confirm Recording of Deed', dueDays: 30 },
  { name: 'Receive Keys / Access', dueDays: 30 },
  { name: 'Notify Team: Deal Closed', dueDays: 30 },
];

export const POST_CLOSING_TASKS: TaskTemplate[] = [
  { name: 'Send Tenant Notification Letters', dueDays: 1 },
  { name: 'Transfer Utilities', dueDays: 3 },
  { name: 'Transition Property Management', dueDays: 5 },
  { name: 'Set Up Bank Accounts', dueDays: 5 },
  { name: 'LP Closing Report', dueDays: 7 },
];

export const STAGE_TEMPLATES: Record<PipelineStage, TaskTemplate[]> = {
  post_loi: POST_LOI_TASKS,
  due_diligence: DUE_DILIGENCE_TASKS,
  pre_closing: PRE_CLOSING_TASKS,
  post_closing: POST_CLOSING_TASKS,
};
