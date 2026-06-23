// Shared domain constants for the Investor CRM.
// UI chrome (titles, buttons, stat labels) is localized via next-intl; the
// domain enum option labels below are internal-tool values kept inline here so
// the list/form/timeline components share one source of truth.

import type {
  CrmInvestorStatus,
  CrmLifecycleState,
  CrmMessageType,
  CrmMessageDirection,
  CrmContactMethod,
  CrmStrategy,
  CrmTenantCreditPref,
  CrmInvestingAs,
  CrmOwnershipPref,
} from '@/lib/types/database';

export const TEAM_MEMBERS = [
  'Gideon Gratsiani',
  'Shirel Ben Harroush',
  'Adir Yonasi',
  'Stephen',
] as const;

// ── Status (Lead -> Repeat) ──────────────────────────────────────────────────
export interface StatusOption {
  value: CrmInvestorStatus;
  label: string;
  /** pill classes (light theme) */
  pill: string;
  /** solid accent color for the card's left border / dot */
  accent: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'lead', label: 'Lead', pill: 'bg-rp-gray-200 text-rp-gray-600', accent: '#6B7280' },
  { value: 'qualified', label: 'Qualified', pill: 'bg-rp-amber-light text-rp-amber', accent: '#D97706' },
  { value: 'committed', label: 'Committed', pill: 'bg-[#EAF1FB] text-[#1D5FB8]', accent: '#1D5FB8' },
  { value: 'funded', label: 'Funded', pill: 'bg-rp-green-light text-rp-green', accent: '#0B8A4D' },
  { value: 'repeat', label: 'Repeat', pill: 'bg-[#F3EBFB] text-[#7C3AED]', accent: '#7C3AED' },
];

export const STATUS_MAP: Record<CrmInvestorStatus, StatusOption> = STATUS_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o }),
  {} as Record<CrmInvestorStatus, StatusOption>,
);

// ── Message types ────────────────────────────────────────────────────────────
export interface MessageTypeOption {
  value: CrmMessageType;
  label: string;
  icon: string; // emoji per spec
}

export const MESSAGE_TYPES: MessageTypeOption[] = [
  { value: 'note', label: 'Note', icon: '📝' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'phone_call', label: 'Phone Call', icon: '📞' },
  { value: 'text_message', label: 'Text', icon: '📱' },
  { value: 'zoom', label: 'Zoom', icon: '🎥' },
  { value: 'meeting', label: 'Meeting', icon: '🤝' },
  { value: 'document_sent', label: 'Document Sent', icon: '📄' },
  { value: 'commitment', label: 'Commitment', icon: '✅' },
  { value: 'follow_up', label: 'Follow-Up', icon: '🔔' },
];

export const MESSAGE_TYPE_MAP: Record<CrmMessageType, MessageTypeOption> = MESSAGE_TYPES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o }),
  {} as Record<CrmMessageType, MessageTypeOption>,
);

// ── Direction ────────────────────────────────────────────────────────────────
export interface DirectionOption {
  value: CrmMessageDirection;
  label: string;
  indicator: string; // arrow glyph
  className: string;
}

export const DIRECTIONS: DirectionOption[] = [
  { value: 'outbound', label: 'Outbound', indicator: '↗', className: 'text-[#1D5FB8]' },
  { value: 'inbound', label: 'Inbound', indicator: '↙', className: 'text-rp-green' },
  { value: 'internal', label: 'Internal', indicator: '•', className: 'text-rp-gray-400' },
];

export const DIRECTION_MAP: Record<CrmMessageDirection, DirectionOption> = DIRECTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o }),
  {} as Record<CrmMessageDirection, DirectionOption>,
);

// ── Contact methods ──────────────────────────────────────────────────────────
export const CONTACT_METHODS: { value: CrmContactMethod; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'text_message', label: 'Text' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'zoom', label: 'Zoom' },
];

// ── Investment preferences vocab ─────────────────────────────────────────────
export const PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: 'multifamily', label: 'Multifamily' },
  { value: 'retail', label: 'Retail' },
  { value: 'office', label: 'Office' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'specialty', label: 'Specialty' },
  { value: 'mixed_use', label: 'Mixed-Use' },
  { value: 'nnn', label: 'NNN' },
  { value: 'medical', label: 'Medical' },
  { value: 'self_storage', label: 'Self Storage' },
];

export const PROPERTY_TYPE_LABEL: Record<string, string> = PROPERTY_TYPES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);

export const MARKETS: string[] = [
  'Southeast',
  'Texas',
  'Midwest',
  'Northeast',
  'West Coast',
  'Florida',
  'Nationwide',
];

export const STRATEGIES: { value: CrmStrategy; label: string }[] = [
  { value: 'value_add', label: 'Value-Add' },
  { value: 'stabilized', label: 'Stabilized' },
  { value: 'opportunistic', label: 'Opportunistic' },
  { value: 'either', label: 'Either' },
];

export const STRATEGY_LABEL: Record<string, string> = STRATEGIES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);

export const STRUCTURE_PREFERENCES: { value: string; label: string }[] = [
  { value: 'seller_financing', label: 'Seller Financing' },
  { value: 'seller_mezzanine', label: 'Seller Mezzanine' },
  { value: 'assumable', label: 'Assumable Loan' },
  { value: 'subject_to', label: 'Subject-To' },
  { value: 'none', label: 'None' },
];

export const STRUCTURE_LABEL: Record<string, string> = STRUCTURE_PREFERENCES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);

// ── Mandate-only vocab ───────────────────────────────────────────────────────
export const LISTING_TYPES: { value: string; label: string }[] = [
  { value: 'on_market', label: 'On-Market' },
  { value: 'off_market', label: 'Off-Market' },
];
export const LISTING_TYPE_LABEL: Record<string, string> = LISTING_TYPES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);

export const PROPERTY_CLASSES: { value: string; label: string }[] = [
  { value: 'A', label: 'Class A' },
  { value: 'B', label: 'Class B' },
  { value: 'C', label: 'Class C' },
];
export const PROPERTY_CLASS_LABEL: Record<string, string> = PROPERTY_CLASSES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);

export const TENANT_CREDIT_PREFS: { value: CrmTenantCreditPref; label: string }[] = [
  { value: 'investment_grade', label: 'Investment-Grade Required' },
  { value: 'mixed', label: 'Mixed OK' },
  { value: 'not_important', label: 'Not Important' },
];
export const TENANT_CREDIT_LABEL: Record<string, string> = TENANT_CREDIT_PREFS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);

// ── Investor identity (Group A) vocab ────────────────────────────────────────
export const INVESTING_AS_OPTIONS: { value: CrmInvestingAs; label: string }[] = [
  { value: 'principal', label: 'Principal' },
  { value: 'fund', label: 'Fund' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'jv', label: 'JV' },
  { value: '1031', label: '1031 Exchange' },
];

export const CAPITAL_READY_BUCKETS: { value: string; label: string }[] = [
  { value: '<1M', label: 'Under $1,000,000' },
  { value: '1-3M', label: '$1,000,000 – $3,000,000' },
  { value: '3-5M', label: '$3,000,000 – $5,000,000' },
  { value: '5-10M', label: '$5,000,000 – $10,000,000' },
  { value: '10M+', label: '$10,000,000+' },
  { value: 'flexible', label: 'Flexible' },
];

export const OWNERSHIP_PREFS: { value: CrmOwnershipPref; label: string }[] = [
  { value: 'direct', label: 'Acquire Directly' },
  { value: 'gp_lp', label: 'GP / LP Partner' },
  { value: 'either', label: 'Either' },
];

export const TIMELINE_OPTIONS: { value: string; label: string }[] = [
  { value: 'now', label: 'Now' },
  { value: '<3mo', label: 'Within 3 months' },
  { value: '3-6mo', label: '3 – 6 months' },
  { value: '6mo+', label: '6+ months' },
];

// ── Lifecycle states (from terminal_crm_investor_summary.lifecycle_state) ────
export interface LifecycleOption {
  value: CrmLifecycleState;
  label: string;
  icon: string;
  pill: string;
}

export const LIFECYCLE_OPTIONS: LifecycleOption[] = [
  { value: 'lead',      label: 'Lead',      icon: '·', pill: 'bg-rp-gray-200 text-rp-gray-600' },
  { value: 'invited',   label: 'Invited',   icon: '✉', pill: 'bg-rp-amber-light text-rp-amber' },
  { value: 'submitted', label: 'Submitted', icon: '✓', pill: 'bg-rp-green-light text-rp-green' },
  { value: 'active',    label: 'Active',    icon: '🔒', pill: 'bg-rp-gold-bg text-rp-gold' },
];

export const LIFECYCLE_MAP: Record<CrmLifecycleState, LifecycleOption> = LIFECYCLE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o }),
  {} as Record<CrmLifecycleState, LifecycleOption>,
);
