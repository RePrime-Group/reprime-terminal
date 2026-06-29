'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { matchListings } from '@/lib/portal/client';
import { listingToDeal, type PromotedDealStatus } from '@/lib/portal/listing-to-deal';
import { downloadAndUploadPhotos } from '@/lib/portal/promote-photos';
import type { MatchedListing, MatchRequest } from '@/lib/portal/types';

export type FetchMatchesResult =
  | {
      ok: true;
      total: number;
      limit: number;
      offset: number;
      listings: MatchedListing[];
      /** Set of portal listing IDs that are already promoted to terminal_deals. */
      alreadyPromoted: string[];
    }
  | { ok: false; error: string };

const criteriaSchema = z
  .object({
    min_price: z.number().nonnegative().optional(),
    max_price: z.number().nonnegative().optional(),
    min_cap: z.number().nonnegative().optional(),
    max_cap: z.number().nonnegative().optional(),
    min_occupancy: z.number().min(0).max(100).optional(),
    max_occupancy: z.number().min(0).max(100).optional(),
    min_sqft: z.number().nonnegative().optional(),
    max_sqft: z.number().nonnegative().optional(),
    max_price_per_sf: z.number().nonnegative().optional(),
    states: z.array(z.string()).optional(),
    property_types: z.array(z.string()).optional(),
    property_class: z.array(z.string()).optional(),
    listing_types: z.array(z.string()).optional(),
    include_portfolio: z.boolean().optional(),
    only_active: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().nonnegative().optional(),
    sort: z
      .enum(['newest', 'price_asc', 'price_desc', 'cap_desc', 'date_on_market_desc'])
      .optional(),
  })
  .strict();

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Sign in required.' };

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || (profile.role !== 'owner' && profile.role !== 'employee')) {
    return { ok: false as const, error: 'Forbidden.' };
  }
  return { ok: true as const, supabase, userId: profile.id };
}

export async function fetchMatches(criteria: MatchRequest): Promise<FetchMatchesResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const parsed = criteriaSchema.safeParse(criteria);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid criteria.' };
  }

  const result = await matchListings(parsed.data);
  if (!result.ok) return { ok: false, error: result.message };

  const ids = result.data.listings.map((l) => l.listing_id);
  let alreadyPromoted: string[] = [];
  if (ids.length > 0) {
    const { data: existing } = await staff.supabase
      .from('terminal_deals')
      .select('source_portal_listing_id')
      .in('source_portal_listing_id', ids);
    alreadyPromoted = (existing ?? [])
      .map((r) => r.source_portal_listing_id as string | null)
      .filter((v): v is string => !!v);
  }

  return {
    ok: true,
    total: result.data.total,
    limit: result.data.limit,
    offset: result.data.offset,
    listings: result.data.listings,
    alreadyPromoted,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// promoteListings
// ────────────────────────────────────────────────────────────────────────────

export interface PromoteOutcome {
  listing_id: string;
  listing_title: string;
  status: 'created' | 'failed' | 'skipped';
  deal_id?: string;
  error?: string;
  /** Non-fatal warnings (e.g. some photos failed to copy). */
  warnings?: string[];
}

export type PromoteListingsResult =
  | { ok: true; outcomes: PromoteOutcome[] }
  | { ok: false; error: string };

const MAX_PER_BATCH = 25;

const promoteSchema = z
  .object({
    listings: z
      .array(
        z.object({
          listing_id: z.string().uuid(),
          listing_title: z.string(),
          listing_type: z.string(),
          asking_price: z.number().nullable(),
          cap_rate: z.number().nullable(),
          noi: z.number().nullable(),
          occupancy: z.number().nullable(),
          marketing_description: z.string().nullable(),
          listing_url: z.string().nullable(),
          images: z.array(z.string()),
          date_on_market: z.string().nullable(),
          created_at: z.string(),
          is_portfolio: z.boolean(),
          total_building_size_sf: z.number().nullable(),
          price_per_sf: z.number().nullable(),
          property_count: z.number(),
          primary_property: z.unknown(),
          properties: z.array(z.unknown()),
        }),
      )
      .min(1)
      .max(MAX_PER_BATCH),
    status: z.enum(['draft', 'marketplace', 'investor_only']),
    tabId: z.string().uuid().nullable(),
    mandateId: z.string().uuid().nullable(),
  })
  .strict();

export async function promoteListings(input: {
  listings: MatchedListing[];
  status: PromotedDealStatus;
  tabId: string | null;
  mandateId: string | null;
}): Promise<PromoteListingsResult> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };

  const parsed = promoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid promote payload.' };
  }

  // If a tab was chosen, confirm it exists + is enabled. Cheap one-shot check.
  if (input.tabId) {
    const { data: tab, error: tabErr } = await staff.supabase
      .from('terminal_investor_tabs')
      .select('id, is_enabled')
      .eq('id', input.tabId)
      .maybeSingle();
    if (tabErr) return { ok: false, error: `Group lookup failed: ${tabErr.message}` };
    if (!tab) return { ok: false, error: 'Selected group no longer exists.' };
    if (!tab.is_enabled) return { ok: false, error: 'Selected group is disabled.' };
  }

  // Pre-fetch already-promoted ids in one shot so we can skip duplicates
  // cleanly instead of relying on the unique-index error.
  const ids = input.listings.map((l) => l.listing_id);
  const { data: existing } = await staff.supabase
    .from('terminal_deals')
    .select('source_portal_listing_id')
    .in('source_portal_listing_id', ids);
  const alreadyPromotedSet = new Set(
    (existing ?? [])
      .map((r) => r.source_portal_listing_id as string | null)
      .filter((v): v is string => !!v),
  );

  const outcomes: PromoteOutcome[] = [];

  // Sequential. Keeps photo downloads polite to image hosts and avoids
  // running 25 parallel Supabase writes from one request.
  for (const listing of input.listings) {
    if (alreadyPromotedSet.has(listing.listing_id)) {
      outcomes.push({
        listing_id: listing.listing_id,
        listing_title: listing.listing_title,
        status: 'skipped',
        error: 'Already a deal.',
      });
      continue;
    }

    const outcome = await promoteOne(staff.supabase, listing, {
      status: input.status,
      tabId: input.tabId,
      mandateId: input.mandateId,
      createdBy: staff.userId,
    });
    outcomes.push(outcome);
  }

  // Refresh sourcing + deals lists for next render.
  revalidatePath('/[locale]/admin/sourcing', 'page');
  revalidatePath('/[locale]/admin/deals', 'page');

  return { ok: true, outcomes };
}

async function promoteOne(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listing: MatchedListing,
  opts: {
    status: PromotedDealStatus;
    tabId: string | null;
    mandateId: string | null;
    createdBy: string;
  },
): Promise<PromoteOutcome> {
  const { deal, addresses } = listingToDeal(listing, {
    status: opts.status,
    mandateId: opts.mandateId,
    createdBy: opts.createdBy,
  });

  // 1. Insert the deal row.
  const { data: created, error: dealErr } = await supabase
    .from('terminal_deals')
    .insert(deal)
    .select('id')
    .single();
  if (dealErr || !created) {
    return {
      listing_id: listing.listing_id,
      listing_title: listing.listing_title,
      status: 'failed',
      error: dealErr?.message ?? 'Deal insert returned no row.',
    };
  }
  const dealId = created.id as string;

  // 2. Portfolio addresses (if any).
  if (addresses.length > 0) {
    const { error: addrErr } = await supabase
      .from('terminal_deal_addresses')
      .insert(addresses.map((a) => ({ ...a, deal_id: dealId })));
    if (addrErr) {
      await rollbackDeal(supabase, dealId);
      return {
        listing_id: listing.listing_id,
        listing_title: listing.listing_title,
        status: 'failed',
        error: `Address insert failed: ${addrErr.message}`,
      };
    }
  }

  // 3. Group assignment (if any).
  if (opts.tabId) {
    const { error: tabErr } = await supabase
      .from('terminal_deal_tab_assignments')
      .insert({
        deal_id: dealId,
        tab_id: opts.tabId,
        status: 'active',
        assigned_by: opts.createdBy,
      });
    if (tabErr) {
      await rollbackDeal(supabase, dealId);
      return {
        listing_id: listing.listing_id,
        listing_title: listing.listing_title,
        status: 'failed',
        error: `Group assignment failed: ${tabErr.message}`,
      };
    }
  }

  // 4. Photos. Best-effort — failures here surface as warnings, not a hard fail.
  const warnings: string[] = [];
  if (listing.images.length > 0) {
    const { uploaded, errors } = await downloadAndUploadPhotos(
      supabase,
      dealId,
      listing.images,
    );
    if (uploaded.length > 0) {
      const { error: photoRowErr } = await supabase.from('terminal_deal_photos').insert(
        uploaded.map((u) => ({
          deal_id: dealId,
          storage_path: u.storagePath,
          display_order: u.displayOrder,
        })),
      );
      if (photoRowErr) warnings.push(`photo rows: ${photoRowErr.message}`);
    }
    warnings.push(...errors);
  }

  return {
    listing_id: listing.listing_id,
    listing_title: listing.listing_title,
    status: 'created',
    deal_id: dealId,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

async function rollbackDeal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealId: string,
) {
  // ON DELETE CASCADE on terminal_deal_addresses / _photos / _tab_assignments
  // means a single delete cleans dependent rows. We deliberately swallow the
  // delete error: if it fails, the caller already has a more useful original
  // error to surface, and leaving an orphan row is recoverable.
  await supabase.from('terminal_deals').delete().eq('id', dealId);
}
