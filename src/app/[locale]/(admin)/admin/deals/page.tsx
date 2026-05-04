import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import DealListClient, {
  type DealListItem,
  type LatestMessage,
  type PipelineSummary,
} from '@/components/admin/DealListClient';
import type { DealStatus, PipelineStage, TaskStatus } from '@/lib/types/database';

export const metadata = { title: 'Deals — RePrime Terminal Beta Admin' };

const DEAL_COLUMNS =
  'id, name, city, state, property_type, purchase_price, status, dd_deadline, close_deadline, created_at, noi, square_footage, occupancy, cap_rate, coc, irr';

export default async function DealsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: dealsRaw } = await supabase
    .from('terminal_deals')
    .select(DEAL_COLUMNS)
    .order('created_at', { ascending: false });

  const deals = (dealsRaw ?? []) as Array<{
    id: string;
    name: string;
    city: string;
    state: string;
    property_type: string;
    purchase_price: string;
    status: DealStatus;
    dd_deadline: string | null;
    close_deadline: string | null;
    created_at: string;
    noi: string | null;
    square_footage: string | null;
    occupancy: string | null;
    cap_rate: string | null;
    coc: string | null;
    irr: string | null;
  }>;

  const dealIds = deals.map((d) => d.id);

  const [
    { data: photos },
    { data: messages },
    { data: stages },
    { data: tasks },
  ] = await Promise.all([
    admin
      .from('terminal_deal_photos')
      .select('deal_id, storage_path, display_order')
      .in('deal_id', dealIds)
      .order('display_order', { ascending: true }),
    dealIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from('terminal_deal_messages')
          .select('deal_id, message, created_at, terminal_users(full_name)')
          .in('deal_id', dealIds)
          .order('created_at', { ascending: false }),
    dealIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from('terminal_deal_stages')
          .select('deal_id, stage, is_current')
          .in('deal_id', dealIds)
          .eq('is_current', true),
    dealIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from('terminal_deal_tasks')
          .select('deal_id, status')
          .in('deal_id', dealIds),
  ]);

  // First photo per deal (by display_order ascending — already sorted)
  const photoByDeal = new Map<string, string>();
  for (const p of (photos ?? []) as Array<{ deal_id: string; storage_path: string }>) {
    if (!photoByDeal.has(p.deal_id)) photoByDeal.set(p.deal_id, p.storage_path);
  }

  // Resolve to public URLs (single bucket, batched in a loop — same pattern as marketplace page)
  const photoUrlByDeal = new Map<string, string>();
  for (const [dealId, path] of photoByDeal.entries()) {
    const { data: urlData } = admin.storage.from('terminal-deal-photos').getPublicUrl(path);
    if (urlData?.publicUrl) photoUrlByDeal.set(dealId, urlData.publicUrl);
  }

  // Most recent message per deal (messages query is ordered DESC, take the first per deal)
  const latestMessageByDeal = new Map<string, LatestMessage>();
  for (const m of (messages ?? []) as Array<{
    deal_id: string;
    message: string;
    created_at: string;
    terminal_users: { full_name: string | null } | { full_name: string | null }[] | null;
  }>) {
    if (latestMessageByDeal.has(m.deal_id)) continue;
    const userField = m.terminal_users;
    const fullName = Array.isArray(userField)
      ? userField[0]?.full_name ?? null
      : userField?.full_name ?? null;
    latestMessageByDeal.set(m.deal_id, {
      message: m.message,
      created_at: m.created_at,
      author_name: fullName,
    });
  }

  // Current stage + task progress per deal
  const stageByDeal = new Map<string, PipelineStage>();
  for (const s of (stages ?? []) as Array<{ deal_id: string; stage: PipelineStage }>) {
    stageByDeal.set(s.deal_id, s.stage);
  }

  const taskCountsByDeal = new Map<string, { completed: number; total: number }>();
  for (const t of (tasks ?? []) as Array<{ deal_id: string; status: TaskStatus }>) {
    const counts = taskCountsByDeal.get(t.deal_id) ?? { completed: 0, total: 0 };
    counts.total += 1;
    if (t.status === 'completed') counts.completed += 1;
    taskCountsByDeal.set(t.deal_id, counts);
  }

  const items: DealListItem[] = deals.map((deal) => {
    const stage = stageByDeal.get(deal.id) ?? null;
    const counts = taskCountsByDeal.get(deal.id) ?? null;
    const pipeline: PipelineSummary | null =
      stage || counts
        ? {
            stage,
            completed: counts?.completed ?? 0,
            total: counts?.total ?? 0,
          }
        : null;
    return {
      ...deal,
      photo_url: photoUrlByDeal.get(deal.id) ?? null,
      latest_message: latestMessageByDeal.get(deal.id) ?? null,
      pipeline,
    };
  });

  return <DealListClient deals={items} locale={locale} />;
}
