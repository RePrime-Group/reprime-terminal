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
  loi_signed: 'LOI Signed',
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
  'loi_signed',
  'published',
  'under_review',
  'assigned',
  'closed',
  'cancelled',
] as const;

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
