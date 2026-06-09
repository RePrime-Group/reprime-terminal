// Shared shapes for the admin Investor Group Tabs screens.
// Server pages build these from Supabase rows and pass them to the client
// components below. Kept in one small file so the pieces stay in sync.

export interface GroupSummary {
  id: string;
  name: string;
  is_enabled: boolean;
  hero_note: string | null;
  created_at: string;
  member_count: number;
  deal_count: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  is_enabled: boolean;
  hero_note: string | null;
}

export interface MemberRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export interface AssignedDealRow {
  deal_id: string;
  name: string;
  status: string;
  city: string | null;
  state: string | null;
  match_reason: string | null;
  internal_note: string | null;
  display_order: number;
}

export interface PickableInvestor {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface PickableDeal {
  id: string;
  name: string;
  status: string;
  city: string | null;
  state: string | null;
}
