/**
 * Reference JSON examples shown on the bulk-import page. Kept dependency-free
 * (no zod) so the client bundle stays light. The import file may be a top-level
 * array of these objects, or an object of the form { "deals": [ ... ] }.
 *
 * Notes for authors:
 *  - Numbers may be JSON numbers or strings ("2333500" or 2333500).
 *  - Monetary fields are PLAIN numbers — no "$" or commas.
 *  - cap_rate / irr / coc / dscr / equity_required / loan_estimate are computed
 *    automatically and must NOT be included.
 *  - is_portfolio is derived: include 2+ "addresses" to make a portfolio deal.
 *  - status defaults to "draft" if omitted.
 */

export interface DealImportExample {
  id: string;
  title: string;
  description: string;
  deal: Record<string, unknown>;
}

const singleProperty: Record<string, unknown> = {
  name: '1200 Market Street',
  property_type: 'Office',
  address: '1200 Market St',
  city: 'Philadelphia',
  state: 'PA',
  square_footage: '85000',
  class_type: 'B',
  year_built: '1998',
  occupancy: '92',
  purchase_price: '14200000',
  noi: '1278000',
  seller_financing: false,
  hold_period_years: '5',
  acquisition_thesis:
    'Value-add office acquisition below replacement cost with near-term lease-up upside in a recovering CBD submarket.',
  investment_highlights: [
    'Priced 18% below replacement cost',
    'Below-market in-place rents with 2026 rollover',
    'Adjacent to new transit investment',
  ],
};

const singleWithTenants: Record<string, unknown> = {
  name: 'Kroger-Anchored Center',
  property_type: 'Retail',
  address: '4500 Peachtree Rd',
  city: 'Atlanta',
  state: 'GA',
  square_footage: '62000',
  occupancy: '95',
  purchase_price: '9800000',
  noi: '735000',
  ltv: '70',
  interest_rate: '6.50',
  tenants: [
    {
      tenant_name: 'Kroger',
      suite_unit: 'A',
      leased_sf: 45000,
      annual_base_rent: 472500,
      rent_per_sf: 10.5,
      lease_type: 'NNN',
      lease_start_date: '01/2019',
      lease_end_date: '12/2034',
      option_renewals: '4x5yr',
      escalation_structure: '10% every 5 years',
      is_anchor: true,
      is_vacant: false,
      tenant_industry: 'Grocery',
      tenant_credit_rating: 'Investment Grade',
    },
    {
      tenant_name: 'Vacant',
      suite_unit: 'B-3',
      leased_sf: 3200,
      is_vacant: true,
      market_rent_estimate: 22,
    },
  ],
};

const portfolio: Record<string, unknown> = {
  name: 'Sunbelt Industrial Portfolio',
  property_type: 'Industrial',
  city: 'Dallas',
  state: 'TX',
  purchase_price: '31500000',
  noi: '2205000',
  // 2+ addresses => this is treated as a portfolio; the top-level "address"
  // is ignored and each building's street lives in its own entry.
  addresses: [
    {
      label: 'Building 1 — Garland',
      address: '101 Industrial Blvd',
      city: 'Garland',
      state: 'TX',
      square_footage: '120000',
    },
    {
      label: 'Building 2 — Mesquite',
      address: '880 Logistics Way',
      city: 'Mesquite',
      state: 'TX',
      square_footage: '95000',
    },
  ],
  tenants: [
    {
      tenant_name: 'FedEx Ground',
      address_label: 'Building 1 — Garland',
      leased_sf: 120000,
      annual_base_rent: 960000,
      rent_per_sf: 8.0,
      lease_type: 'NNN',
      is_anchor: true,
      tenant_credit_rating: 'Investment Grade',
    },
    {
      tenant_name: 'Regional 3PL Co',
      address_label: 'Building 2 — Mesquite',
      leased_sf: 95000,
      annual_base_rent: 712500,
      rent_per_sf: 7.5,
      lease_type: 'NNN',
      tenant_credit_rating: 'Regional',
    },
  ],
};

export const DEAL_IMPORT_EXAMPLES: DealImportExample[] = [
  {
    id: 'single',
    title: 'Single property',
    description: 'Minimal single-building deal. Metrics are computed from price + NOI.',
    deal: singleProperty,
  },
  {
    id: 'single-tenants',
    title: 'Single property + tenants',
    description: 'A single building with a tenant roster, including a vacant suite.',
    deal: singleWithTenants,
  },
  {
    id: 'portfolio',
    title: 'Portfolio + tenants',
    description: '2+ addresses make a portfolio; tenants map to a building via address_label.',
    deal: portfolio,
  },
];

/** A ready-to-download starter file containing one of each example. */
export const DEAL_IMPORT_TEMPLATE = {
  deals: DEAL_IMPORT_EXAMPLES.map((e) => e.deal),
};
