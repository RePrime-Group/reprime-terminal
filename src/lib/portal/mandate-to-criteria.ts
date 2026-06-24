import type { TerminalCrmMandate } from '@/lib/types/database';
import type { MatchRequest } from './types';
import { mapPropertyTypesToPortal, mapStatesToPortal } from './vocabulary';

// Fields the portal does NOT currently support, OR vocab the portal can't
// interpret. Surfaced in `unsupported` so the UI can warn the admin that
// part of the criteria isn't being applied.
export type UnsupportedMandateField =
  | 'min_coc'
  | 'min_lease_term_years'
  | 'strategy'
  | 'tenant_credit_pref'
  | 'structure_prefs'
  | 'listing_types'    // terminal vocab (on/off_market) is a sourcing-stage
                       //   concept; portal uses transaction-type vocab. Skip.
  | 'property_class';  // portal's `prop_class` is NOT A/B/C grade. Skip.

export interface MandateTranslation {
  criteria: MatchRequest;
  unsupported: UnsupportedMandateField[];
  /** Mandate property_type values with no portal equivalent (e.g. "nnn"). */
  droppedPropertyTypes: string[];
  /** Mandate state/region values that didn't translate (typo / unknown). */
  droppedStates: string[];
}

export function mandateToCriteria(mandate: TerminalCrmMandate): MandateTranslation {
  const criteria: MatchRequest = {};

  const minPrice = num(mandate.min_price);
  if (minPrice !== null) criteria.min_price = minPrice;
  const maxPrice = num(mandate.max_price);
  if (maxPrice !== null) criteria.max_price = maxPrice;

  const minCap = num(mandate.min_cap);
  if (minCap !== null) criteria.min_cap = minCap;

  const minOcc = num(mandate.min_occupancy);
  if (minOcc !== null) criteria.min_occupancy = minOcc;
  const maxOcc = num(mandate.max_occupancy);
  if (maxOcc !== null) criteria.max_occupancy = maxOcc;

  const minSqft = num(mandate.min_sqft);
  if (minSqft !== null) criteria.min_sqft = minSqft;
  const maxSqft = num(mandate.max_sqft);
  if (maxSqft !== null) criteria.max_sqft = maxSqft;

  const maxPsf = num(mandate.price_per_sf_max);
  if (maxPsf !== null) criteria.max_price_per_sf = maxPsf;

  // property_types: snake_case → Pascal-case via mapping table.
  const pt = mapPropertyTypesToPortal(mandate.property_types);
  if (pt.mapped.length > 0) criteria.property_types = pt.mapped;

  // states: region names → 2-letter codes. Nationwide → no filter.
  const st = mapStatesToPortal(mandate.states);
  if (!st.isNationwide && st.mapped.length > 0) criteria.states = st.mapped;

  const unsupported: UnsupportedMandateField[] = [];
  if (num(mandate.min_coc) !== null) unsupported.push('min_coc');
  if (num(mandate.min_lease_term_years) !== null) unsupported.push('min_lease_term_years');
  if (mandate.strategy) unsupported.push('strategy');
  if (mandate.tenant_credit_pref) unsupported.push('tenant_credit_pref');
  if (mandate.structure_prefs.length > 0) unsupported.push('structure_prefs');
  if (mandate.listing_types.length > 0) unsupported.push('listing_types');
  if (mandate.property_class.length > 0) unsupported.push('property_class');

  return {
    criteria,
    unsupported,
    droppedPropertyTypes: pt.dropped,
    droppedStates: st.dropped,
  };
}

function num(v: string | null): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
