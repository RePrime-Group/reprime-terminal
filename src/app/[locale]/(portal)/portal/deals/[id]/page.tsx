import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import DealDetailClient from '@/components/portal/DealDetailClient';
import type { TerminalDeal, TerminalDealPhoto, TerminalTenantLease, CapExItem, ExitScenario } from '@/lib/types/database';
import {
  getGlobalFeeDefaults,
  resolveAllFees,
  resolveInvestorTerms,
  type InvestorTerms,
} from '@/lib/utils/fee-resolver';

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
  'id', 'name', 'city', 'state', 'address', 'is_portfolio', 'property_type',
  'square_footage', 'units', 'class_type', 'year_built', 'year_renovated', 'occupancy',
  'purchase_price', 'noi', 'cap_rate', 'irr', 'coc', 'dscr',
  'equity_required', 'loan_estimate', 'seller_financing', 'special_terms',
  'assignment_fee', 'assignment_irr', 'gplp_irr',
  'acq_fee', 'asset_mgmt_fee', 'gp_carry', 'loan_fee',
  'dd_deadline', 'close_deadline', 'extension_deadline', 'timeline_note',
  'deposit_amount', 'deposit_held_by', 'om_storage_path',
  'loi_signed_storage_path', 'psa_storage_path', 'full_report_storage_path', 'costar_report_storage_path', 'tenants_report_storage_path', 'lease_summary_storage_path',
  'neighborhood', 'metro_population', 'job_growth',
  'investment_highlights', 'acquisition_thesis',
  'ltv', 'interest_rate', 'amortization_years', 'loan_fee_points', 'io_period_months',
  'mezz_percent', 'mezz_rate', 'mezz_term_months',
  'seller_credit', 'pref_return',
  'area_cap_rate', 'asking_cap_rate',
  'hold_period_years', 'exit_cap_rate', 'rent_growth',
  'legal_title_estimate', 'disposition_cost_pct', 'capex',
  'debt_terms_quoted',
  'show_rent_roll', 'show_capex', 'show_exit_strategy', 'computed_walt',
  'status', 'cancellation_reason',
].join(', ');

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Prev/Next deal navigation — coming_soon deals are intentionally excluded
  // from the nav list (they're still shown on the dashboard, but investors
  // shouldn't auto-cycle into them via ◀/▶). Same sort as the browse page for
  // the included statuses.
  const INVESTOR_NAV_STATUSES = ['loi_signed', 'published', 'assigned', 'closed', 'cancelled'] as const;
  const STATUS_ORDER: Record<string, number> = {
    loi_signed: 1, published: 2, assigned: 3, closed: 4, cancelled: 5,
  };

  // Parallel batch 1: deal + photos + counts + pipeline + addresses + investor + NDA + tenants + nav list
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
    { data: tenantsData },
    { data: capexItemsData },
    { data: exitScenariosData },
    { data: navDealsData },
    { data: userNoteData },
  ] = await Promise.all([
    supabase
      .from('terminal_deals')
      .select(DEAL_COLUMNS)
      .eq('id', id)
      .in('status', ['coming_soon', 'marketplace', 'loi_signed', 'published', 'assigned', 'closed', 'cancelled'])
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
      .eq('user_id', user.id)
      .eq('nda_type', 'blanket')
      .limit(1),
    supabase
      .from('terminal_nda_signatures')
      .select('id')
      .eq('user_id', user.id)
      .eq('nda_type', 'deal')
      .eq('deal_id', id)
      .limit(1),
    supabase
      .from('tenant_leases')
      .select('*')
      .eq('deal_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('capex_items')
      .select('*')
      .eq('deal_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('exit_scenarios')
      .select('*')
      .eq('deal_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('terminal_deals')
      .select('id, name, status, dd_deadline')
      .in('status', INVESTOR_NAV_STATUSES)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_deal_notes')
      .select('content, updated_at')
      .eq('user_id', user.id)
      .eq('deal_id', id)
      .maybeSingle(),
  ]);

  if (!dealData) redirect(`/${locale}/portal`);

  const deal = dealData as unknown as TerminalDeal;

  const [globalFeeDefaults, investorTermsResult] = await Promise.all([
    getGlobalFeeDefaults(supabase),
    supabase
      .from('user_investment_terms')
      .select('assignment_fee, acq_fee, asset_mgmt_fee, gp_carry, pref_return')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  const resolvedDealFees = resolveAllFees(
    deal as unknown as Record<string, unknown>,
    globalFeeDefaults,
  );
  const investorTerms = (investorTermsResult.data ?? null) as InvestorTerms | null;
  const resolvedInvestorTerms = resolveInvestorTerms(investorTerms, globalFeeDefaults);

  const navDeals = (navDealsData ?? []).slice().sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 2;
    const orderB = STATUS_ORDER[b.status] ?? 2;
    if (orderA !== orderB) return orderA - orderB;
    if (a.dd_deadline && b.dd_deadline) {
      return new Date(a.dd_deadline).getTime() - new Date(b.dd_deadline).getTime();
    }
    if (a.dd_deadline) return -1;
    if (b.dd_deadline) return 1;
    return 0;
  });
  const currentIdx = navDeals.findIndex((d) => d.id === id);
  const prevDeal = currentIdx > 0
    ? { id: navDeals[currentIdx - 1].id, name: navDeals[currentIdx - 1].name }
    : null;
  const nextDeal = currentIdx >= 0 && currentIdx < navDeals.length - 1
    ? { id: navDeals[currentIdx + 1].id, name: navDeals[currentIdx + 1].name }
    : null;

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
s
  // Marketplace-specific data: total interest count + this user's existing
  // interest row (so the form can pre-fill on revisit).
  let marketplaceInterestCount = 0;
  let myMarketplaceInterest: {
    interest_type: 'at_asking' | 'custom_price';
    target_price: number | null;
    notes: string | null;
  } | null = null;
  if (deal.status === 'marketplace') {
    const admin = createAdminClient();
    const [{ data: countRows }, { data: myRow }] = await Promise.all([
      admin.from('marketplace_interest').select('id').eq('deal_id', id),
      supabase
        .from('marketplace_interest')
        .select('interest_type, target_price, notes')
        .eq('deal_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);
    marketplaceInterestCount = countRows?.length ?? 0;
    if (myRow) {
      myMarketplaceInterest = {
        interest_type: myRow.interest_type as 'at_asking' | 'custom_price',
        target_price: myRow.target_price,
        notes: myRow.notes,
      };
    }
  }

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
      tenants={(tenantsData ?? []) as TerminalTenantLease[]}
      capexItems={(capexItemsData ?? []) as CapExItem[]}
      exitScenarios={(exitScenariosData ?? []) as ExitScenario[]}
      prevDeal={prevDeal}
      nextDeal={nextDeal}
      userNote={userNoteData ?? null}
      globalFeeDefaults={globalFeeDefaults}
      resolvedDealFees={resolvedDealFees}
      resolvedInvestorTerms={resolvedInvestorTerms}
      marketplaceInterestCount={marketplaceInterestCount}
      myMarketplaceInterest={myMarketplaceInterest}
    />
  );
}
