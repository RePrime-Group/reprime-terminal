// Mirror of the Reprime Portal /api/external/match-listings contract.
// Kept in sync by hand — if the portal endpoint changes shape, update here too.

export type MatchSort =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'cap_desc'
  | 'date_on_market_desc';

export interface MatchRequest {
  // Money / yield
  min_price?: number;
  max_price?: number;
  min_cap?: number;
  max_cap?: number;
  min_occupancy?: number;
  max_occupancy?: number;
  // Size — applies to SUM(properties.building_size_sf) per listing
  min_sqft?: number;
  max_sqft?: number;
  // Derived: asking_price / summed building_size_sf
  max_price_per_sf?: number;
  // Categorical
  states?: string[];
  property_types?: string[];
  property_class?: string[];
  listing_types?: string[];
  // Inclusion controls
  include_portfolio?: boolean;
  only_active?: boolean;
  // Pagination
  limit?: number;
  offset?: number;
  // Sorting
  sort?: MatchSort;
}

export interface PropertySummary {
  property_id: string;
  property_name: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string | null;
  property_type: string | null;
  prop_class: string | null;
  prop_sub_type: string | null;
  building_size_sf: number | null;
  lot_size_acres: number | null;
  year_built: number | null;
  latitude: number | null;
  longitude: number | null;
  units_count: number | null;
}

export interface MatchedListing {
  listing_id: string;
  listing_title: string;
  listing_type: string;
  asking_price: number | null;
  cap_rate: number | null;
  noi: number | null;
  occupancy: number | null;
  marketing_description: string | null;
  listing_url: string | null;
  images: string[];
  date_on_market: string | null;
  created_at: string;
  is_portfolio: boolean;
  total_building_size_sf: number | null;
  price_per_sf: number | null;
  property_count: number;
  primary_property: PropertySummary | null;
  properties: PropertySummary[];
}

export interface MatchResponse {
  total: number;
  limit: number;
  offset: number;
  listings: MatchedListing[];
}
