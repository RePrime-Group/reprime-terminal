/**
 * Pure helpers + types for mandate forms — used by BOTH server components
 * (e.g. /criteria page) and client components (CrmMandatesTab,
 * CrmMandateForm, CriteriaFormClient).
 *
 * Anything that needs to be referenced from a server component lives here
 * — NOT in CrmMandateForm.tsx, which is a 'use client' boundary and would
 * make these values client-only at the RSC graph level.
 */

import type { CrmStrategy, CrmTenantCreditPref } from '@/lib/types/database';

/** The input shape for a single mandate (form-state, not the DB row). */
export interface MandateInput {
  label?: string | null;
  property_types: string[];
  listing_types: string[];
  states: string[];
  property_class: string[];
  structure_prefs: string[];
  min_price?: number | null;
  max_price?: number | null;
  min_cap?: number | null;
  min_coc?: number | null;
  min_occupancy?: number | null;
  max_occupancy?: number | null;
  min_sqft?: number | null;
  max_sqft?: number | null;
  price_per_sf_max?: number | null;
  min_lease_term_years?: number | null;
  strategy?: CrmStrategy | null;
  tenant_credit_pref?: CrmTenantCreditPref | null;
  notes?: string | null;
}

export const EMPTY_MANDATE: MandateInput = {
  label: '',
  property_types: [],
  listing_types: [],
  states: [],
  property_class: [],
  structure_prefs: [],
  min_price: null,
  max_price: null,
  min_cap: null,
  min_coc: null,
  min_occupancy: null,
  max_occupancy: null,
  min_sqft: null,
  max_sqft: null,
  price_per_sf_max: null,
  min_lease_term_years: null,
  strategy: null,
  tenant_credit_pref: null,
  notes: '',
};

/** Convert a DB row into the form's input shape. */
export function mandateRowToInput(row: {
  label: string | null;
  property_types: string[];
  listing_types: string[];
  states: string[];
  property_class: string[];
  structure_prefs: string[];
  min_price: string | null;
  max_price: string | null;
  min_cap: string | null;
  min_coc: string | null;
  min_occupancy: string | null;
  max_occupancy: string | null;
  min_sqft: string | null;
  max_sqft: string | null;
  price_per_sf_max: string | null;
  min_lease_term_years: string | null;
  strategy: CrmStrategy | null;
  tenant_credit_pref: CrmTenantCreditPref | null;
  notes: string | null;
}): MandateInput {
  const toN = (v: string | null) => (v == null ? null : Number(v));
  return {
    label: row.label,
    property_types: row.property_types ?? [],
    listing_types: row.listing_types ?? [],
    states: row.states ?? [],
    property_class: row.property_class ?? [],
    structure_prefs: row.structure_prefs ?? [],
    min_price: toN(row.min_price),
    max_price: toN(row.max_price),
    min_cap: toN(row.min_cap),
    min_coc: toN(row.min_coc),
    min_occupancy: toN(row.min_occupancy),
    max_occupancy: toN(row.max_occupancy),
    min_sqft: toN(row.min_sqft),
    max_sqft: toN(row.max_sqft),
    price_per_sf_max: toN(row.price_per_sf_max),
    min_lease_term_years: toN(row.min_lease_term_years),
    strategy: row.strategy,
    tenant_credit_pref: row.tenant_credit_pref,
    notes: row.notes,
  };
}

/** Validate per the plan's "minimum required set". */
export function validateMandate(m: MandateInput): string | null {
  if (m.property_types.length === 0) return 'Pick at least one property type.';
  if (m.states.length === 0) return 'Pick at least one target market.';
  if (m.min_price == null && m.max_price == null) return 'Enter a price minimum or maximum.';
  if (m.min_price != null && m.max_price != null && m.min_price > m.max_price) {
    return 'Price minimum cannot exceed maximum.';
  }
  if (
    m.min_occupancy != null &&
    m.max_occupancy != null &&
    m.min_occupancy > m.max_occupancy
  ) {
    return 'Min occupancy cannot exceed max occupancy.';
  }
  return null;
}
