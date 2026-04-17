import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DealDetailClient from '@/components/portal/DealDetailClient';
import type { TerminalDeal, TerminalDealPhoto } from '@/lib/types/database';

interface DealDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: DealDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('terminal_deals').select('name').eq('id', id).single();
  return { title: data ? `${data.name} — RePrime Terminal Beta` : 'Deal — RePrime Terminal Beta' };
}

// Columns needed by the overview tab + header + hero + metric bar
const DEAL_COLUMNS = [
  'id', 'name', 'city', 'state', 'property_type',
  'square_footage', 'units', 'class_type', 'year_built', 'occupancy',
  'purchase_price', 'noi', 'cap_rate', 'irr', 'coc', 'dscr',
  'equity_required', 'loan_estimate', 'seller_financing', 'special_terms',
  'assignment_fee', 'assignment_irr', 'gplp_irr',
  'acq_fee', 'asset_mgmt_fee', 'gp_carry', 'loan_fee',
  'dd_deadline', 'close_deadline', 'extension_deadline',
  'deposit_amount', 'deposit_held_by', 'om_storage_path',
  'neighborhood', 'metro_population', 'job_growth',
  'investment_highlights', 'acquisition_thesis',
  'ltv', 'interest_rate', 'amortization_years', 'loan_fee_points', 'io_period_months',
  'mezz_percent', 'mezz_rate', 'mezz_term_months',
  'seller_credit', 'pref_return',
  'hold_period_years', 'exit_cap_rate', 'debt_terms_quoted',
  'status',
].join(', ');

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Parallel batch 1: deal + photos + counts + pipeline + addresses + investor + NDA checks
  const [
    { data: dealData },
    { data: photosData },
    { count: viewingCount },
    { count: meetingsCount },
    { data: pipelineTasks },
    { data: addressesData },
    { data: investorProfile },
    { data: blanketNDA },
    { data: dealNDA },
  ] = await Promise.all([
    supabase
      .from('terminal_deals')
      .select(DEAL_COLUMNS)
      .eq('id', id)
      .in('status', ['coming_soon', 'loi_signed', 'published', 'assigned', 'closed'])
      .single(),
    supabase
      .from('terminal_deal_photos')
      .select('storage_path, display_order')
      .eq('deal_id', id)
      .order('display_order', { ascending: true }),
    supabase
      .from('terminal_activity_log')
      .select('user_id', { count: 'exact', head: true })
      .eq('deal_id', id)
      .eq('action', 'deal_viewed'),
    supabase
      .from('terminal_meetings')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', id)
      .in('status', ['scheduled', 'completed']),
    supabase
      .from('terminal_deal_tasks')
      .select('id, name, status, stage')
      .eq('deal_id', id),
    supabase
      .from('terminal_deal_addresses')
      .select('id, label, address, city, state, square_footage, units, om_storage_path, display_order')
      .eq('deal_id', id)
      .order('display_order', { ascending: true }),
    supabase
      .from('terminal_users')
      .select('full_name, email')
      .eq('id', user.id)
      .single(),
    supabase
      .from('terminal_nda_signatures')
      .select('id')
      .eq('nda_type', 'blanket')
      .limit(1),
    supabase
      .from('terminal_nda_signatures')
      .select('id')
      .eq('nda_type', 'deal')
      .eq('deal_id', id)
      .limit(1),
  ]);

  if (!dealData) redirect(`/${locale}/portal`);

  const deal = dealData as unknown as TerminalDeal;

  // Generate photo URLs (synchronous — no DB call)
  const photoUrls = (photosData ?? []).map((photo) => {
    const { data } = supabase.storage.from('terminal-deal-photos').getPublicUrl(photo.storage_path);
    return data.publicUrl;
  });

  // Pipeline progress calculation
  const tasks = pipelineTasks ?? [];
  const pipelineTotal = tasks.length;
  const pipelineCompleted = tasks.filter(t => t.status === 'completed').length;
  const pipelineProgress = pipelineTotal > 0 ? Math.round((pipelineCompleted / pipelineTotal) * 100) : -1;

  const stageOrder = ['post_loi', 'due_diligence', 'pre_closing', 'post_closing'] as const;
  const stageProgress: Record<string, { total: number; completed: number }> = {};
  for (const stage of stageOrder) {
    const stageTasks = tasks.filter(t => t.stage === stage);
    stageProgress[stage] = {
      total: stageTasks.length,
      completed: stageTasks.filter(t => t.status === 'completed').length,
    };
  }

  let currentStage = 'post_loi';
  for (const stage of stageOrder) {
    const sp = stageProgress[stage];
    if (sp.total === 0 || sp.completed < sp.total) {
      currentStage = stage;
      break;
    }
    if (stage === 'post_closing') currentStage = 'post_closing';
  }

  const hasSignedNDA = (blanketNDA?.length ?? 0) > 0 || (dealNDA?.length ?? 0) > 0;

  return (
    <DealDetailClient
      deal={{
        ...deal,
        photos: [] as TerminalDealPhoto[],
        dd_folders: [],
        viewing_count: viewingCount ?? 0,
        meetings_count: meetingsCount ?? 0,
      }}
      photoUrls={photoUrls}
      contactName=""
      contactTitle=""
      contactEmail=""
      availabilitySlots={[]}
      bookedTimes={[]}
      locale={locale}
      pipelineProgress={pipelineProgress}
      stageProgress={stageProgress}
      currentStage={currentStage}
      hasSignedNDA={hasSignedNDA}
      investorName={investorProfile?.full_name ?? 'Member'}
      investorEmail={investorProfile?.email ?? ''}
      addresses={addressesData ?? []}
      pipelineTasks={tasks as { id: string; name: string; status: string; stage: string }[]}
    />
  );
}
