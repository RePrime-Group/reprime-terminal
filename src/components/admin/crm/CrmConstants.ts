// Shared domain constants for the Investor CRM.
// UI chrome (titles, buttons, stat labels) is localized via next-intl; the
// domain enum option labels below are internal-tool values kept inline here so
// the list/form/timeline components share one source of truth.

import type {
  CrmInvestorStatus,
  CrmMessageType,
  CrmMessageDirection,
  CrmContactMethod,
  CrmInvestmentPriority,
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

export const PRIORITIES: { value: CrmInvestmentPriority; label: string }[] = [
  { value: 'cash_flow', label: 'Cash Flow' },
  { value: 'appreciation', label: 'Appreciation' },
  { value: 'balanced', label: 'Balanced' },
];

export const PRIORITY_LABEL: Record<string, string> = PRIORITIES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);

export const STRUCTURE_PREFERENCES: { value: string; label: string }[] = [
  { value: 'traditional', label: 'Traditional' },
  { value: 'seller_mezz', label: 'Seller Mezz' },
  { value: 'all_cash', label: 'All Cash' },
];

export const STRUCTURE_LABEL: Record<string, string> = STRUCTURE_PREFERENCES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>,
);
