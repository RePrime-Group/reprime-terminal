import { z } from 'zod';

/**
 * Validation for bulk XLSX investor imports.
 *
 * Required: first_name, last_name, email.
 * Optional: phone, whatsapp, company_name, title, linkedin_url, source.
 *
 * Header matching is case-insensitive with snake_case OR spaces.
 */

const optText = z.preprocess(
  (v) => (v == null || v === '' ? undefined : typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : v),
  z.string().optional(),
);

const reqText = (label: string) =>
  z.preprocess(
    (v) => (typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : v),
    z.string({ message: `${label} is required` }).min(1, `${label} is required`),
  );

const emailField = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.string({ message: 'email is required' }).email('Not a valid email').min(1, 'email is required'),
);

export const investorRowSchema = z.object({
  first_name: reqText('first_name'),
  last_name: reqText('last_name'),
  email: emailField,
  phone: optText,
  whatsapp: optText,
  company_name: optText,
  title: optText,
  linkedin_url: optText,
  source: optText,
});

export type InvestorImportRow = z.infer<typeof investorRowSchema> & { index: number };

export interface RowError {
  index: number;       // 0-based position in the XLSX (after header row)
  messages: string[];
  raw: Record<string, unknown>;
}

export interface RowConflict {
  index: number;
  email: string;
  existingId: string;
  existingName: string;
}

export interface ValidationResult {
  valid: InvestorImportRow[];
  errors: RowError[];
}

/**
 * Run zod validation across the parsed rows. Returns valid rows (with their
 * original index) plus per-row error lists.
 */
export function validateInvestorImportRows(rows: Record<string, unknown>[]): ValidationResult {
  const valid: InvestorImportRow[] = [];
  const errors: RowError[] = [];

  rows.forEach((raw, index) => {
    const parsed = investorRowSchema.safeParse(raw);
    if (parsed.success) {
      valid.push({ ...parsed.data, index });
    } else {
      errors.push({
        index,
        raw,
        messages: parsed.error.issues.map((iss) => iss.message),
      });
    }
  });

  return { valid, errors };
}

/**
 * Header alias map — incoming spreadsheet headers (case/space-insensitive)
 * are normalized to these canonical keys.
 */
export const HEADER_ALIASES: Record<string, string> = {
  first_name: 'first_name',
  firstname: 'first_name',
  'first name': 'first_name',
  last_name: 'last_name',
  lastname: 'last_name',
  'last name': 'last_name',
  email: 'email',
  'email address': 'email',
  phone: 'phone',
  'phone number': 'phone',
  whatsapp: 'whatsapp',
  'whatsapp number': 'whatsapp',
  company: 'company_name',
  company_name: 'company_name',
  'company name': 'company_name',
  title: 'title',
  role: 'title',
  linkedin: 'linkedin_url',
  linkedin_url: 'linkedin_url',
  'linkedin url': 'linkedin_url',
  source: 'source',
};

export const TEMPLATE_HEADERS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'whatsapp',
  'company_name',
  'title',
  'linkedin_url',
  'source',
] as const;

export const TEMPLATE_EXAMPLE_ROW: Record<string, string> = {
  first_name: 'Marcus',
  last_name: 'Levy',
  email: 'marcus@levycapital.example',
  phone: '+1 555 0142',
  whatsapp: '+1 555 0142',
  company_name: 'Levy Capital Partners',
  title: 'Managing Partner',
  linkedin_url: '',
  source: 'referral',
};
