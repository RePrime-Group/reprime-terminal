import type { DealStatus } from './types/database';

export const BRAND = {
  colors: {
    navy: '#0E3470',
    gold: '#BC9C45',
    goldSoft: '#D4B96A',
    goldBg: '#FDF8ED',
    goldBorder: '#ECD9A0',
    white: '#FFFFFF',
    pageBg: '#F2F4F8',
    green: '#0B8A4D',
    greenLight: '#ECFDF5',
    greenBorder: '#A7F3D0',
    red: '#DC2626',
    redLight: '#FEF2F2',
    redBorder: '#FECACA',
    amber: '#D97706',
    amberLight: '#FFFBEB',
    amberBorder: '#FDE68A',
    blue: '#1D5FB8',
    gray100: '#F7F8FA',
    gray200: '#EEF0F4',
    gray300: '#D1D5DB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray600: '#4B5563',
    gray700: '#374151',
    loginBg: '#07090F',
  },
} as const;

export const CRE_TERMS = [
  'IRR', 'NOI', 'DSCR', 'Cap Rate', 'CoC', 'LTV',
  'EBITDA', 'LOI', 'PSA', 'DD', 'NNN', 'CMBS',
  'ARGUS', 'MAI', 'PCA', 'ESA',
] as const;

export const DEAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  coming_soon: 'Coming Soon',
  marketplace: 'Marketplace',
  investor_only: 'Investor Only',
  loi_signed: 'LOI Signed',
  pending_final_loi: 'Pending Final LOI',
  psa_signed: 'PSA Signed',
  published: 'Published',
  under_review: 'Under Review',
  assigned: 'Assigned',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const ALL_DEAL_STATUSES = [
  'draft',
  'coming_soon',
  'marketplace',
  'investor_only',
  'loi_signed',
  'pending_final_loi',
  'psa_signed',
  'published',
  'under_review',
  'assigned',
  'closed',
  'cancelled',
] as const;

// A deal that is live in front of investors. `published` was originally the
// only "active" status; loi_signed → pending_final_loi → psa_signed are later
// stages of the same deal, so anywhere that used to mean `published` — hero
// metrics, portfolio counts, portal queries — means all four.
// Ordered to match the investor dashboard sections.
export const ACTIVE_DEAL_STATUSES: DealStatus[] = [
  'psa_signed',
  'loi_signed',
  'pending_final_loi',
  'published',
];

// Deal statuses on which the AI assistant may be offered and will answer.
// MUST stay in step with the `Load Deal & Access` node in the n8n chat
// workflow 6hz22YdBC500tHxg, which is the authoritative gate; this constant
// only decides whether the UI offers the affordance. If the two drift, the
// symptom is silent: the button appears and the request comes back 403.
// Excluded on purpose: draft, coming_soon, under_review.
// `cancelled` was excluded at first, then allowed (Ali, 2026-10-19): two
// investors were still researching cancelled deals weekly, since a dead deal
// is a comp and its dataroom records why it fell through. Note their documents
// are NOT indexed, so document search comes back empty on them.
// NOTE: `investor_only` is allowed here but the workflow additionally requires
// the caller to be a member of a group the deal is assigned to. The UI needs
// no equivalent check, because a non-member cannot open the page at all.
export const AI_ASSISTANT_STATUSES: DealStatus[] = [
  'marketplace',
  'investor_only',
  'loi_signed',
  'pending_final_loi',
  'psa_signed',
  'published',
  'assigned',
  'closed',
  'cancelled',
];

// Admins can move a deal to any status regardless of the current status.
export const DEAL_STATUS_TRANSITIONS: Record<string, { roles: string[]; to: string[] }> =
  Object.fromEntries(
    ALL_DEAL_STATUSES.map((from) => [
      from,
      {
        roles: ['owner', 'employee'],
        to: ALL_DEAL_STATUSES.filter((s) => s !== from),
      },
    ])
  );

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/x-tiff',
  'image/svg+xml',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/apng',
  'image/vnd.microsoft.icon',
  'image/x-icon',
];
export const ACCEPTED_DOC_TYPES = [
  // PDF
  'application/pdf',
  'application/x-pdf',
  'application/acrobat',
  'applications/vnd.pdf',
  'text/pdf',
  'text/x-pdf',
  // Excel (modern + legacy + macro-enabled + binary + template)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/vnd.ms-excel.template.macroEnabled.12',
  // Word (modern + legacy + macro-enabled)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/msword',
  'application/vnd.ms-word.document.macroEnabled.12',
  'application/vnd.ms-word.template.macroEnabled.12',
  // CSV / text
  'text/csv',
  'application/csv',
  'text/plain',
  // Zip
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/octet-stream',
];
export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
  'video/x-m4v',
];
export const MAX_IMAGE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_DOC_SIZE = 1024 * 1024 * 1024; // 1GB — no limit for DD uploads
export const MAX_IMAGE_WIDTH = 1600;

// Investor Group Tabs: whether marketplace_only investors who belong to an
// enabled group still see their curated group tab(s). Flip to false to hide
// curated tabs from marketplace_only members. (Curated reads are RLS-gated
// regardless; this only controls the navbar entry.)
export const SHOW_CURATED_TABS_FOR_MARKETPLACE_ONLY = true;
