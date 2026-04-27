// Shape of the KYC payload submitted from the form. The raw SSN field is
// stripped before persistence — it's encrypted into terminal_user_kyc.ssn_encrypted
// instead, and never lives in the `data` JSONB column.

export interface KYCAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface KYCPersonal {
  legalName: string;
  dob: string;                // ISO date YYYY-MM-DD
  ssn: string;                // raw on the wire only; encrypted server-side
  driversLicense?: string;
  address: KYCAddress;
  phone: string;
  email: string;
}

export interface KYCEmployment {
  occupation: string;
  employer: string;
  employerAddress?: string;
  industry?: string;
  annualIncome: string;
  sourceOfFunds: string;
}

export interface KYCFinancial {
  netWorth: string;
  investmentRange?: string;
  otherInstitutions: {
    hasAccounts: boolean;
    institutionName?: string;
  };
}

export interface KYCAccreditation {
  individualIncome: boolean;
  jointIncome: boolean;
  netWorthExceeds1M: boolean;
  licensedProfessional: boolean;
  knowledgeableEmployee: boolean;
  entityAssets: boolean;
  notAccredited: boolean;
}

export interface KYCFormData {
  personal: KYCPersonal;
  employment: KYCEmployment;
  financial: KYCFinancial;
  accreditation: KYCAccreditation;
  certifiedTrue: boolean;
}

/** What the UI submits to the server. */
export interface KYCSubmitPayload {
  data: KYCFormData;
  /** When true, do not validate required fields or run auto-approval. */
  partial: boolean;
}

/** Returns true when at least one accreditation criterion (other than "not accredited") is checked. */
export function isAccredited(a: KYCAccreditation): boolean {
  return (
    a.individualIncome ||
    a.jointIncome ||
    a.netWorthExceeds1M ||
    a.licensedProfessional ||
    a.knowledgeableEmployee ||
    a.entityAssets
  );
}

export const ANNUAL_INCOME_OPTIONS = [
  'Under $100K',
  '$100K – $250K',
  '$250K – $500K',
  '$500K – $1M',
  '$1M – $5M',
  '$5M+',
] as const;

export const SOURCE_OF_FUNDS_OPTIONS = [
  'Employment',
  'Business Income',
  'Investments',
  'Inheritance',
  'Real Estate',
  'Savings',
  'Other',
] as const;

export const NET_WORTH_OPTIONS = [
  'Under $500K',
  '$500K – $1M',
  '$1M – $5M',
  '$5M – $10M',
  '$10M – $25M',
  '$25M+',
] as const;

export const INVESTMENT_RANGE_OPTIONS = [
  'Under $100K',
  '$100K – $250K',
  '$250K – $500K',
  '$500K – $1M',
  '$1M – $5M',
  '$5M+',
] as const;

export const REQUIRED_TOP_LEVEL_FIELDS = [
  'personal.legalName',
  'personal.dob',
  'personal.ssn',
  'personal.address.street',
  'personal.address.city',
  'personal.address.state',
  'personal.address.zip',
  'personal.phone',
  'employment.occupation',
  'employment.employer',
  'employment.annualIncome',
  'employment.sourceOfFunds',
  'financial.netWorth',
] as const;
