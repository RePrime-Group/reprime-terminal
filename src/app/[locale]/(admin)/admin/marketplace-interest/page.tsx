import { createClient } from '@/lib/supabase/server';
import MarketplaceInterestListClient from '@/components/admin/MarketplaceInterestListClient';

export const metadata = { title: 'Marketplace Interest — RePrime Terminal Beta Admin' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type InterestFilter = 'all' | 'at_asking' | 'custom_price';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminMarketplaceInterestPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.p || '1', 10) || 1);
  const interestFilter: InterestFilter = (
    ['all', 'at_asking', 'custom_price'].includes(sp.type || '')
      ? sp.type!
      : 'all'
  ) as InterestFilter;
  const dealFilter = sp.deal && sp.deal !== 'all' ? sp.deal : null;

  // Counts by interest type (for the filter pills)
  const [{ count: allCount }, { count: askingCount }, { count: customCount }] =
    await Promise.all([
      supabase.from('marketplace_interest').select('*', { count: 'exact', head: true }),
      supabase.from('marketplace_interest').select('*', { count: 'exact', head: true }).eq('interest_type', 'at_asking'),
      supabase.from('marketplace_interest').select('*', { count: 'exact', head: true }).eq('interest_type', 'custom_price'),
    ]);

  const counts: Record<InterestFilter, number> = {
    all: allCount ?? 0,
    at_asking: askingCount ?? 0,
    custom_price: customCount ?? 0,
  };

  // Deal filter dropdown options — only deals that have at least one interest row
  const { data: dealsWithInterest } = await supabase
    .from('marketplace_interest')
    .select('deal_id, terminal_deals!deal_id(name, city, state)')
    .order('created_at', { ascending: false });

  // supabase-js's generated types treat embedded selects as arrays even for
  // many-to-one joins; coerce through `unknown` and tolerate either shape.
  type DealJoin = { name: string; city: string; state: string };
  const dealOptionsMap = new Map<string, DealJoin>();
  for (const row of (dealsWithInterest ?? []) as unknown as Array<{
    deal_id: string;
    terminal_deals: DealJoin | DealJoin[] | null;
  }>) {
    const did = row.deal_id;
    const raw = row.terminal_deals;
    const d: DealJoin | null = Array.isArray(raw) ? raw[0] ?? null : raw;
    if (did && d && !dealOptionsMap.has(did)) dealOptionsMap.set(did, d);
  }
  const dealOptions = Array.from(dealOptionsMap.entries()).map(([id, d]) => ({
    id,
    label: `${d.name} — ${d.city}, ${d.state}`,
  }));

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('marketplace_interest')
    .select(`
      id,
      deal_id,
      user_id,
      interest_type,
      target_price,
      notes,
      created_at,
      terminal_users!user_id ( full_name, email, company_name ),
      terminal_deals!deal_id ( name, city, state, purchase_price, status )
    `, { count: 'exact' })
    .order('created_at', { ascending: false });
  if (interestFilter !== 'all') query = query.eq('interest_type', interestFilter);
  if (dealFilter) query = query.eq('deal_id', dealFilter);

  const { data: rows, count: filteredTotal } = await query.range(from, to);

  type UserJoin = { full_name: string; email: string; company_name: string | null };
  type DealJoinFull = { name: string; city: string; state: string; purchase_price: string | null; status: string };
  type Row = {
    id: string;
    deal_id: string;
    user_id: string;
    interest_type: string;
    target_price: number | null;
    notes: string | null;
    created_at: string;
    terminal_users: UserJoin | UserJoin[] | null;
    terminal_deals: DealJoinFull | DealJoinFull[] | null;
  };
  const pick = <T,>(v: T | T[] | null | undefined): T | null =>
    v == null ? null : Array.isArray(v) ? v[0] ?? null : v;

  const flat = ((rows ?? []) as unknown as Row[]).map((r) => {
    const u = pick(r.terminal_users);
    const d = pick(r.terminal_deals);
    return {
    id: r.id,
    deal_id: r.deal_id,
    deal_name: d?.name ?? 'Unknown',
    deal_location: d ? `${d.city}, ${d.state}` : '',
    deal_status: d?.status ?? null,
    asking_price: d?.purchase_price ?? null,
    investor_name: u?.full_name ?? 'Unknown',
    investor_email: u?.email ?? '',
    investor_company: u?.company_name ?? null,
    interest_type: r.interest_type as 'at_asking' | 'custom_price',
    target_price: r.target_price,
    notes: r.notes,
    created_at: r.created_at,
    };
  });

  return (
    <MarketplaceInterestListClient
      rows={flat}
      total={filteredTotal ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      counts={counts}
      interestFilter={interestFilter}
      dealOptions={dealOptions}
      dealFilter={dealFilter}
      locale={locale}
    />
  );
}
