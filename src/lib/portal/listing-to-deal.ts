import type { MatchedListing, PropertySummary } from './types';

export type PromotedDealStatus = 'draft' | 'marketplace' | 'investor_only';

export interface DealInsert {
  name: string;
  city: string;
  state: string;
  property_type: string;
  square_footage: string | null;
  units: string | null;
  class_type: string | null;
  year_built: number | null;
  occupancy: string | null;
  purchase_price: string;       // NOT NULL — '0' if missing
  noi: string | null;
  cap_rate: string | null;
  teaser_description: string | null;
  is_portfolio: boolean;
  address: string | null;
  status: PromotedDealStatus;
  source: 'portal_match';
  source_portal_listing_id: string;
  source_mandate_id: string | null;
  created_by: string;
}

export interface AddressInsert {
  label: string;
  address: string | null;
  city: string | null;
  state: string | null;
  square_footage: string | null;
  units: string | null;
  year_built: number | null;
  display_order: number;
}

export interface ListingTranslation {
  deal: DealInsert;
  /** Empty for single-property listings; one row per property otherwise. */
  addresses: AddressInsert[];
}

/**
 * Build the rows we'll insert when promoting a portal listing to a
 * terminal_deal. Mirrors the existing numeric-as-string convention used by
 * /admin/deals/new (raw digits, no commas, no $/% symbols — UI formats on
 * display).
 */
export function listingToDeal(
  listing: MatchedListing,
  opts: {
    status: PromotedDealStatus;
    mandateId: string | null;
    createdBy: string;
  },
): ListingTranslation {
  const primary = listing.primary_property ?? listing.properties[0] ?? null;

  // Derived sqft / units. For portfolios we prefer the portal-supplied sum;
  // for single-property we use the primary's value.
  const sqftNumber =
    listing.total_building_size_sf ?? primary?.building_size_sf ?? null;
  const totalUnits = sumUnits(listing.properties);

  const deal: DealInsert = {
    name: listing.listing_title,
    city: primary?.city ?? '',
    state: primary?.state ?? '',
    // property_type is NOT NULL in terminal_deals; fall back to a safe default.
    property_type: primary?.property_type ?? 'Other',
    square_footage: numStr(sqftNumber),
    units: numStr(totalUnits),
    // portal's `prop_class` is NOT building-grade A/B/C — leave blank rather
    // than mislabel.
    class_type: null,
    year_built: primary?.year_built ?? null,
    occupancy: numStr(listing.occupancy),
    purchase_price: numStr(listing.asking_price) ?? '0',
    noi: numStr(listing.noi),
    cap_rate: numStr(listing.cap_rate),
    teaser_description: listing.marketing_description,
    is_portfolio: listing.is_portfolio,
    address: primary?.address ?? null,
    status: opts.status,
    source: 'portal_match',
    source_portal_listing_id: listing.listing_id,
    source_mandate_id: opts.mandateId,
    created_by: opts.createdBy,
  };

  const addresses: AddressInsert[] = listing.is_portfolio
    ? listing.properties.map((p, i) => ({
        label: p.property_name ?? p.address ?? `Property ${i + 1}`,
        address: p.address ?? null,
        city: p.city ?? null,
        state: p.state ?? null,
        square_footage: numStr(p.building_size_sf),
        units: numStr(p.units_count),
        year_built: p.year_built,
        display_order: i,
      }))
    : [];

  return { deal, addresses };
}

function numStr(v: number | null): string | null {
  if (v === null) return null;
  return String(v);
}

function sumUnits(props: PropertySummary[]): number | null {
  const total = props.reduce((s, p) => s + (p.units_count ?? 0), 0);
  // 0 isn't a meaningful value here — treat as "unknown".
  return total > 0 ? total : null;
}
