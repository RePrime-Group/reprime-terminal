import { createAdminClient } from '@/lib/supabase/admin';

// Fetches everything the Seller Brief needs in one round-trip:
//   - the deal row itself
//   - all addresses (portfolio support — empty array for single-property deals
//     because non-portfolio deals don't have rows in terminal_deal_addresses)
//   - every tenant on the deal (across all addresses, sorted)
//   - every capex item on the deal (across all addresses, sorted)
//
// The brief renders the whole portfolio in one view, so tenant and capex queries
// are filtered by deal_id only — no per-address filtering.

export interface SellerBriefData {
  deal: Record<string, unknown>;
  addresses: Record<string, unknown>[];
  tenants: Record<string, unknown>[];
  capexItems: Record<string, unknown>[];
}

export async function getDealBriefData(dealId: string): Promise<SellerBriefData> {
  const admin = createAdminClient();

  const [dealRes, addressesRes, tenantsRes, capexRes] = await Promise.all([
    admin.from('terminal_deals').select('*').eq('id', dealId).single(),
    admin
      .from('terminal_deal_addresses')
      .select('*')
      .eq('deal_id', dealId)
      .order('display_order', { ascending: true }),
    admin
      .from('tenant_leases')
      .select('*')
      .eq('deal_id', dealId)
      .order('sort_order', { ascending: true }),
    admin
      .from('capex_items')
      .select('*')
      .eq('deal_id', dealId)
      .order('sort_order', { ascending: true }),
  ]);

  if (dealRes.error || !dealRes.data) {
    throw new Error(dealRes.error?.message ?? 'Deal not found');
  }

  return {
    deal: dealRes.data as Record<string, unknown>,
    addresses: (addressesRes.data ?? []) as Record<string, unknown>[],
    tenants: (tenantsRes.data ?? []) as Record<string, unknown>[],
    capexItems: (capexRes.data ?? []) as Record<string, unknown>[],
  };
}
