// DD Document Templates — sourced from RePrime Acquisition Framework v3
// Each template defines the complete checklist for a property type
// Documents are auto-populated when a deal is created

export interface DDTemplateDoc {
  name: string;
  folder: string;        // folder name to place in
  subFolder?: string;    // optional sub-category
  owner: string;         // default assignee
  neededByDay: number;   // days after PSA execution (0 = not required)
  tooltip: string;       // hover explanation
  isRetailSpecific?: boolean;  // ★ retail-only items
}

export interface DDFolder {
  id: string;
  name: string;
  icon: string;
  subFolders?: { id: string; name: string }[];
}

export const DD_FOLDERS: DDFolder[] = [
  { id: '01', name: 'Marketing', icon: '📢' },
  { id: '02', name: 'Market Research', icon: '📊' },
  { id: '03', name: 'Legal', icon: '⚖️', subFolders: [
    { id: '03a', name: 'LOI' }, { id: '03b', name: 'PSA' }, { id: '03c', name: 'Title' },
    { id: '03d', name: 'Survey' }, { id: '03e', name: 'Entity' }, { id: '03f', name: 'Closing' },
  ]},
  { id: '04', name: 'Financials', icon: '💰', subFolders: [
    { id: '04a', name: 'Operating Statements' }, { id: '04b', name: 'Rent Rolls' },
    { id: '04c', name: 'Accounts Receivable' }, { id: '04d', name: 'Bank Statements' },
    { id: '04e', name: 'Taxes' }, { id: '04f', name: 'Utilities' },
  ]},
  { id: '05', name: 'Leases', icon: '📋', subFolders: [
    { id: '05a', name: 'Current Leases' }, { id: '05b', name: 'Lease Abstracts' },
    { id: '05c', name: 'Estoppels' }, { id: '05d', name: 'Tenant Files' },
    { id: '05e', name: 'Retail Specific' },
  ]},
  { id: '06', name: 'DD Reports', icon: '🔍', subFolders: [
    { id: '06a', name: 'Environmental' }, { id: '06b', name: 'Physical' },
    { id: '06c', name: 'Appraisal' }, { id: '06d', name: 'Inspections' },
    { id: '06e', name: 'DD Findings' },
  ]},
  { id: '07', name: 'Financing / Lenders', icon: '🏦', subFolders: [
    { id: '07a', name: 'Term Sheets' }, { id: '07b', name: 'Loan Application' },
    { id: '07c', name: 'Loan Documents' },
  ]},
  { id: '08', name: 'Insurance', icon: '🛡️' },
  { id: '09', name: 'Presentations', icon: '📽️' },
  { id: '10', name: 'Site Visit', icon: '📸' },
  { id: '11', name: 'Investor Materials', icon: '👥' },
  { id: '12', name: 'Post-Closing', icon: '✅' },
];

// ═══════════════ MULTIFAMILY TEMPLATE ═══════════════
export const MULTIFAMILY_DOCS: DDTemplateDoc[] = [
  // Marketing
  { name: 'Original Offering Memorandum', folder: 'Marketing', owner: 'Team', neededByDay: 1, tooltip: "Broker's marketing package. Baseline for all analysis." },
  { name: 'Website/Online Listings', folder: 'Marketing', owner: 'Team', neededByDay: 2, tooltip: 'Screenshots of current marketing presence.' },
  { name: 'Professional Photos', folder: 'Marketing', owner: 'Team', neededByDay: 2, tooltip: 'Exterior, common areas, unit interiors, amenities.' },

  // Market Research
  { name: 'CoStar / Crexi Reports', folder: 'Market Research', owner: 'Team', neededByDay: 3, tooltip: 'Comparable sales and rental data.' },
  { name: 'Demographics Report (1/3/5 mile)', folder: 'Market Research', owner: 'Team', neededByDay: 5, tooltip: 'Population, income, growth trends within radius.' },

  // Financials — Operating Statements
  { name: 'Trailing 12-Month Operating Statement (T-12)', folder: 'Financials', subFolder: 'Operating Statements', owner: 'Team', neededByDay: 3, tooltip: 'Full year of income and expense. Management fees, R&M, insurance, taxes.' },
  { name: 'Trailing 3-Month Operating Statement (T-3)', folder: 'Financials', subFolder: 'Operating Statements', owner: 'Team', neededByDay: 3, tooltip: 'Most recent quarter. Compare against T-12 for trend analysis.' },
  { name: 'Year-to-Date Operating Statement', folder: 'Financials', subFolder: 'Operating Statements', owner: 'Team', neededByDay: 5, tooltip: 'Current year actuals. Critical for measuring against pro forma.' },
  { name: 'Prior 2-3 Years Operating Statements', folder: 'Financials', subFolder: 'Operating Statements', owner: 'Team', neededByDay: 7, tooltip: 'Historical trend data. Look for expense spikes and revenue dips.' },
  { name: 'Capital Expenditure History', folder: 'Financials', subFolder: 'Operating Statements', owner: 'Team', neededByDay: 10, tooltip: 'What the seller has spent. Validates deferred maintenance claims.' },

  // Financials — Rent Rolls
  { name: 'Current Rent Roll (with unit mix)', folder: 'Financials', subFolder: 'Rent Rolls', owner: 'Team', neededByDay: 2, tooltip: 'Unit-by-unit: rent, lease term, deposits, vacancy. The single most important DD doc.' },
  { name: 'Historical Rent Rolls (12 months)', folder: 'Financials', subFolder: 'Rent Rolls', owner: 'Team', neededByDay: 7, tooltip: 'Monthly snapshots showing occupancy trajectory and lease-up velocity.' },

  // Financials — Accounts Receivable
  { name: 'Accounts Receivable Aging Report', folder: 'Financials', subFolder: 'Accounts Receivable', owner: 'Team', neededByDay: 5, tooltip: '30/60/90 day aging. Reveals collection problems the rent roll won\'t show.' },
  { name: 'Bad Debt Write-Off History', folder: 'Financials', subFolder: 'Accounts Receivable', owner: 'Team', neededByDay: 10, tooltip: 'Actual losses from non-paying tenants.' },
  { name: 'Security Deposit Ledger', folder: 'Financials', subFolder: 'Accounts Receivable', owner: 'Seller', neededByDay: 7, tooltip: 'Deposits transfer at closing. Must reconcile against lease terms.' },

  // Financials — Bank Statements
  { name: 'Bank Statements (12 months)', folder: 'Financials', subFolder: 'Bank Statements', owner: 'Seller', neededByDay: 10, tooltip: 'Verify actual cash collections match reported income. Non-negotiable.' },

  // Financials — Taxes
  { name: 'Property Tax Bills (2-3 years)', folder: 'Financials', subFolder: 'Taxes', owner: 'Team', neededByDay: 5, tooltip: 'Current assessment and rate. Check for reassessment trigger at sale.' },

  // Financials — Utilities
  { name: 'Utility Bills (12 months)', folder: 'Financials', subFolder: 'Utilities', owner: 'Team', neededByDay: 10, tooltip: 'Electric, gas, water, sewer, trash. Broken out by month.' },

  // Leases
  { name: 'All Residential Leases', folder: 'Leases', subFolder: 'Current Leases', owner: 'Team', neededByDay: 5, tooltip: 'Every executed lease. Verify against rent roll terms.' },
  { name: 'Lease Expiration Schedule', folder: 'Leases', subFolder: 'Lease Abstracts', owner: 'Team', neededByDay: 5, tooltip: 'Rollover risk analysis. Flag any >20% expiring in same quarter.' },
  { name: 'Concession Schedule (current)', folder: 'Leases', subFolder: 'Lease Abstracts', owner: 'Team', neededByDay: 7, tooltip: 'Free rent, reduced deposits, waived fees.' },
  { name: 'Move-In/Move-Out Report (12 months)', folder: 'Leases', subFolder: 'Tenant Files', owner: 'Seller', neededByDay: 10, tooltip: 'Turnover velocity. High turnover = hidden costs.' },
  { name: 'Delinquency/Eviction Log', folder: 'Leases', subFolder: 'Tenant Files', owner: 'Team', neededByDay: 10, tooltip: 'Active evictions and chronic late payers.' },

  // Legal
  { name: 'Current Deed', folder: 'Legal', owner: 'Team', neededByDay: 2, tooltip: 'Vesting, legal description, any deed restrictions.' },
  { name: 'Title Policy (existing)', folder: 'Legal', subFolder: 'Title', owner: 'Team', neededByDay: 5, tooltip: 'Prior policy. Compare exceptions against new title commitment.' },
  { name: 'Existing Survey', folder: 'Legal', subFolder: 'Survey', owner: 'Team', neededByDay: 7, tooltip: 'May need update. Check for encroachments and easement conflicts.' },
  { name: 'Zoning Confirmation Letter', folder: 'Legal', owner: 'Team', neededByDay: 7, tooltip: 'Municipal confirmation of current classification and permitted use.' },
  { name: 'Certificate of Occupancy', folder: 'Legal', owner: 'Team', neededByDay: 7, tooltip: 'Legal occupancy for current use. Required by lender.' },
  { name: 'Litigation Disclosure', folder: 'Legal', owner: 'Seller', neededByDay: 10, tooltip: 'Pending or threatened litigation. Material liability assessment.' },
  { name: 'Property Management Agreement', folder: 'Legal', owner: 'Team', neededByDay: 10, tooltip: 'Current PM terms. 30-day termination clause required.' },
  { name: 'Service Contracts', folder: 'Legal', owner: 'Team', neededByDay: 10, tooltip: 'Landscaping, cleaning, security, elevator. Assignment or termination.' },
  { name: 'Vendor Contracts', folder: 'Legal', owner: 'Team', neededByDay: 14, tooltip: 'All third-party agreements. Auto-renewal traps.' },
  { name: 'Employee List/Roster', folder: 'Legal', owner: 'Seller', neededByDay: 14, tooltip: 'On-site staff. Salary obligations that transfer.' },

  // DD Reports — Environmental
  { name: 'Phase I ESA', folder: 'DD Reports', subFolder: 'Environmental', owner: 'Team', neededByDay: 5, tooltip: 'ASTM E1527-21 compliant. Standard environmental assessment.' },
  { name: 'Asbestos/Lead Paint Reports', folder: 'DD Reports', subFolder: 'Environmental', owner: 'Team', neededByDay: 10, tooltip: 'Material testing results for pre-1978 buildings.' },

  // DD Reports — Inspections
  { name: 'Property Condition Report (PCR)', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Team', neededByDay: 10, tooltip: 'Physical assessment of all building systems.' },
  { name: 'Capital Needs Assessment', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Team', neededByDay: 10, tooltip: 'Projected capital expenditures over hold period.' },
  { name: 'Roof Condition Report', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Seller', neededByDay: 10, tooltip: 'Remaining warranty term. Transferability to new owner.' },
  { name: 'Elevator Inspection Reports', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Team', neededByDay: 14, tooltip: 'Annual inspection compliance. Modernization needs.' },
  { name: 'Fire Safety Inspection Reports', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Team', neededByDay: 10, tooltip: 'Alarm, sprinkler, extinguisher, egress compliance.' },
  { name: 'HVAC Maintenance Records', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Seller', neededByDay: 14, tooltip: 'Service history. Remaining useful life estimation.' },
  { name: 'Floor Plans (by unit type)', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Team', neededByDay: 10, tooltip: 'SF verification per unit type.' },
  { name: 'Building Systems Specifications', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Team', neededByDay: 14, tooltip: 'HVAC tonnage, electrical capacity, plumbing specs, roof type.' },
  { name: 'Deferred Maintenance List', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Team', neededByDay: 14, tooltip: 'Known issues seller hasn\'t addressed.' },

  // Insurance
  { name: 'Current Insurance Policy', folder: 'Insurance', owner: 'Team', neededByDay: 5, tooltip: 'Coverage limits, deductibles, named perils vs all-risk.' },
  { name: 'Loss Run History (5 years)', folder: 'Insurance', owner: 'Seller', neededByDay: 10, tooltip: 'Claims frequency and severity. Underwriting risk signal.' },
  { name: 'Claims History', folder: 'Insurance', owner: 'Team', neededByDay: 10, tooltip: 'Open claims, pending litigation from prior incidents.' },

  // Presentations
  { name: 'Hebrew Presentation (Master)', folder: 'Presentations', owner: 'Team', neededByDay: 4, tooltip: 'Master deck for investor presentation.' },
  { name: 'English Presentation (Derived)', folder: 'Presentations', owner: 'Team', neededByDay: 4, tooltip: 'English version derived from Hebrew master.' },
  { name: 'Financial Model (Initial)', folder: 'Presentations', owner: 'Team', neededByDay: 4, tooltip: 'Initial underwriting model.' },

  // Site Visit
  { name: 'Site Visit Photos', folder: 'Site Visit', owner: 'Team', neededByDay: 14, tooltip: 'Exterior, interior, common areas, mechanical rooms.' },
];

// ═══════════════ RETAIL-SPECIFIC ADDITIONS ═══════════════
export const RETAIL_ADDITIONS: DDTemplateDoc[] = [
  { name: '★ Percentage Rent Reports (all tenants)', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Team', neededByDay: 10, tooltip: 'Breakpoint analysis. Actual vs natural breakpoint.', isRetailSpecific: true },
  { name: '★ Sales Reports (by tenant, 3 years)', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Seller', neededByDay: 10, tooltip: 'Tenant health indicator. PSF sales benchmarking.', isRetailSpecific: true },
  { name: '★ CAM Reconciliation (3 years)', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Team', neededByDay: 7, tooltip: 'Recovery ratio analysis. Controllable vs uncontrollable.', isRetailSpecific: true },
  { name: '★ CAM Budget (current year)', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Team', neededByDay: 5, tooltip: 'Budgeted vs actual. Management efficiency.', isRetailSpecific: true },
  { name: '★ Insurance Reconciliation (3 years)', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Team', neededByDay: 10, tooltip: 'Insurance recovery from tenants vs landlord cost.', isRetailSpecific: true },
  { name: '★ Tax Reconciliation (3 years)', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Team', neededByDay: 10, tooltip: 'Tax recovery. Base year vs current year exposure.', isRetailSpecific: true },
  { name: '★ Exclusive Use Matrix', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Team', neededByDay: 5, tooltip: 'Which tenants restrict which uses.', isRetailSpecific: true },
  { name: '★ Co-Tenancy Provisions Summary', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Team', neededByDay: 7, tooltip: 'Tenants who can reduce rent if anchors leave.', isRetailSpecific: true },
  { name: '★ Kick-Out Rights Summary', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Team', neededByDay: 10, tooltip: 'Tenants with early termination rights.', isRetailSpecific: true },
  { name: '★ Anchor Tenant Provisions', folder: 'Leases', subFolder: 'Retail Specific', owner: 'Team', neededByDay: 7, tooltip: 'ROFR, expansion options, signage rights, exclusives.', isRetailSpecific: true },
  { name: '★ ADA Compliance Reports', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Team', neededByDay: 14, tooltip: 'Accessibility audit. Remediation cost estimate.', isRetailSpecific: true },
  { name: '★ Parking Field Study', folder: 'DD Reports', subFolder: 'Inspections', owner: 'Team', neededByDay: 14, tooltip: 'Ratio analysis. Peak utilization.', isRetailSpecific: true },
  { name: '★ Traffic Counts', folder: 'Market Research', owner: 'Team', neededByDay: 7, tooltip: 'DOT and third-party counts. Trend analysis.', isRetailSpecific: true },
  { name: '★ Tenant Mix Map', folder: 'Marketing', owner: 'Team', neededByDay: 5, tooltip: 'Visual layout showing all tenants by location.', isRetailSpecific: true },
];

export function getTemplateForPropertyType(propertyType: string): DDTemplateDoc[] {
  const type = propertyType.toLowerCase();
  const base = [...MULTIFAMILY_DOCS];

  if (type.includes('retail') || type.includes('shopping')) {
    return [...base, ...RETAIL_ADDITIONS];
  }
  if (type.includes('mixed')) {
    // Mixed-use gets both residential and commercial variants
    return [...base, ...RETAIL_ADDITIONS];
  }
  // Industrial, Office, etc. use the base template
  return base;
}
