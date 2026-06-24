// Portal-native vocab + translators from terminal mandate vocab to portal vocab.
// Sampled from the Reprime Portal Supabase project (`qwnahtnsodljwyyafawx`)
// — see /admin/sourcing notes on which fields are skip-listed.

// ── Portal vocab (used by the Custom Criteria form) ─────────────────────────

export const PORTAL_PROPERTY_TYPES: { value: string; label: string }[] = [
  { value: 'Retail',          label: 'Retail' },
  { value: 'Industrial',      label: 'Industrial' },
  { value: 'Office',          label: 'Office' },
  { value: 'Multifamily',     label: 'Multifamily' },
  { value: 'Self Storage',    label: 'Self Storage' },
  { value: 'Land',            label: 'Land' },
  { value: 'Mixed Use',       label: 'Mixed Use' },
  { value: 'Hospitality',     label: 'Hospitality' },
  { value: 'Special Purpose', label: 'Special Purpose' },
  { value: 'Specialty',       label: 'Specialty' },
  { value: 'Flex',            label: 'Flex' },
  { value: 'Senior Living',   label: 'Senior Living' },
  { value: 'Medical',         label: 'Medical' },
  { value: 'Build-to-Rent',   label: 'Build-to-Rent' },
];

export const PORTAL_LISTING_TYPES: { value: string; label: string }[] = [
  { value: 'for_sale',         label: 'For Sale' },
  { value: 'for_lease',        label: 'For Lease' },
  { value: 'seller_financing', label: 'Seller Financing' },
  { value: 'for_auction',      label: 'Auction' },
  { value: 'foreclosure',      label: 'Foreclosure' },
  { value: 'distressed',       label: 'Distressed' },
];

export const PORTAL_SORTS: { value: string; label: string }[] = [
  { value: 'newest',                label: 'Newest first' },
  { value: 'price_asc',             label: 'Price: low → high' },
  { value: 'price_desc',            label: 'Price: high → low' },
  { value: 'cap_desc',              label: 'Cap rate: high → low' },
  { value: 'date_on_market_desc',   label: 'Date on market: newest' },
];

export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// ── Terminal mandate vocab → portal vocab translators ───────────────────────

// terminal mandate uses snake_case; portal stores Pascal-case with spaces.
// Unmapped values (e.g. terminal "nnn") get dropped — caller sees them missing
// from the translated array and can surface that fact.
const PROPERTY_TYPE_MAP: Record<string, string> = {
  multifamily:  'Multifamily',
  retail:       'Retail',
  office:       'Office',
  industrial:   'Industrial',
  specialty:    'Specialty',
  mixed_use:    'Mixed Use',
  medical:      'Medical',
  self_storage: 'Self Storage',
  // 'nnn' has no clean portal equivalent — intentionally absent.
};

export function mapPropertyTypesToPortal(values: string[]): {
  mapped: string[];
  dropped: string[];
} {
  const mapped: string[] = [];
  const dropped: string[] = [];
  for (const v of values) {
    const portal = PROPERTY_TYPE_MAP[v];
    if (portal) mapped.push(portal);
    else dropped.push(v);
  }
  return { mapped, dropped };
}

// terminal mandate uses region names; portal stores 2-letter state codes.
// 'Nationwide' yields the empty set — caller treats that as "no state filter".
// Unmapped values get dropped.
const REGION_TO_STATES: Record<string, string[]> = {
  Nationwide:    [],
  Northeast:     ['NY', 'NJ', 'PA', 'CT', 'MA', 'RI', 'NH', 'VT', 'ME'],
  Southeast:     ['FL', 'GA', 'SC', 'NC', 'VA', 'WV', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA'],
  Midwest:       ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'SD', 'ND'],
  Texas:         ['TX'],
  Florida:       ['FL'],
  'West Coast':  ['CA', 'OR', 'WA'],
};

export function mapStatesToPortal(values: string[]): {
  mapped: string[];
  dropped: string[];
  isNationwide: boolean;
} {
  const mappedSet = new Set<string>();
  const dropped: string[] = [];
  let isNationwide = false;
  for (const v of values) {
    if (v === 'Nationwide') {
      isNationwide = true;
      continue;
    }
    // Already a 2-letter US state code? Pass through.
    if (/^[A-Z]{2}$/.test(v)) {
      mappedSet.add(v);
      continue;
    }
    const states = REGION_TO_STATES[v];
    if (states) {
      states.forEach((s) => mappedSet.add(s));
    } else {
      dropped.push(v);
    }
  }
  return { mapped: Array.from(mappedSet).sort(), dropped, isNationwide };
}
