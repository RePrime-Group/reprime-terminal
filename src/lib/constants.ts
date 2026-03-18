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
  published: 'Published',
  under_review: 'Under Review',
  assigned: 'Assigned',
  closed: 'Closed',
};

export const DEAL_STATUS_TRANSITIONS: Record<string, { roles: string[]; to: string[] }> = {
  draft: { roles: ['owner', 'employee'], to: ['published'] },
  published: { roles: ['owner'], to: ['draft', 'under_review'] },
  under_review: { roles: ['owner'], to: ['published', 'assigned'] },
  assigned: { roles: ['owner'], to: ['closed'] },
  closed: { roles: [], to: [] },
};

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DOC_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_IMAGE_WIDTH = 1600;
