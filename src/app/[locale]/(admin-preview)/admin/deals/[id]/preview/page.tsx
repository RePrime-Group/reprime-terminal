import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import DealDetailClient from '@/components/portal/DealDetailClient';
import {
  getGlobalFeeDefaults,
  resolveAllFees,
  resolveInvestorTerms,
} from '@/lib/utils/fee-resolver';
import { ACTIVE_DEAL_STATUSES } from '@/lib/constants';
import type {
  TerminalDeal,
  TerminalDealPhoto,
  TerminalDDFolder,
  TerminalDDDocument,
  TerminalAvailabilitySlot,
  TerminalSetting,
  TerminalTenantLease,
  CapExItem,
  ExitScenario,
  DealInsight,
  DealWithDetails,
} from '@/lib/types/database';

export const metadata = { title: 'Investor Preview — RePrime Terminal Beta Admin' };

interface DealPreviewPageProps {
  params: Promise<{ locale: string; id: string }>;
}

// Admin role check happens in the (admin-preview) group layout.
export default async function DealPreviewPage({ params }: DealPreviewPageProps) {
  const { locale, id } = await params;
  const t = await getTranslations('admin.preview');
  const supabase = await createClient();

  // ---------- Fetch deal (all statuses visible to admin) ----------
  const { data: dealData } = await supabase
    .from('terminal_deals')
    .select('*')
    .eq('id', id)
    .single();

  if (!dealData) {
    redirect(`/${locale}/admin/deals`);
  }

  const deal = dealData as TerminalDeal;

  // ---------- Fetch photos ordered by display_order ----------
  const { data: photosData } = await supabase
    .from('terminal_deal_photos')
    .select('*')
    .eq('deal_id', id)
    .order('display_order', { ascending: true });

  const photos = (photosData as TerminalDealPhoto[]) ?? [];

  // Generate signed URLs for photos
  const photoUrls: string[] = [];
  for (const photo of photos) {
    const { data } = supabase.storage
      .from('terminal-deal-photos')
      .getPublicUrl(photo.storage_path);
    photoUrls.push(data.publicUrl);
  }

  // ---------- Fetch DD folders with their documents ----------
  const { data: foldersData } = await supabase
    .from('terminal_dd_folders')
    .select('*')
    .eq('deal_id', id)
    .order('display_order', { ascending: true });

  const folders = (foldersData as TerminalDDFolder[]) ?? [];

  const foldersWithDocs: (TerminalDDFolder & {
    documents: TerminalDDDocument[];
  })[] = [];

  for (const folder of folders) {
    const { data: docsData } = await supabase
      .from('terminal_dd_documents')
      .select('*')
      .eq('folder_id', folder.id)
      .order('created_at', { ascending: true });

    foldersWithDocs.push({
      ...folder,
      documents: (docsData as TerminalDDDocument[]) ?? [],
    });
  }

  // ---------- Fetch viewing count ----------
  const { count: viewingCount } = await supabase
    .from('terminal_activity_log')
    .select('user_id', { count: 'exact', head: true })
    .eq('deal_id', id)
    .eq('action', 'deal_viewed');

  // ---------- Fetch meetings count ----------
  const { count: meetingsCount } = await supabase
    .from('terminal_meetings')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', id)
    .in('status', ['scheduled', 'completed']);

  // ---------- Fetch settings (contact info) ----------
  const { data: settingsData } = await supabase
    .from('terminal_settings')
    .select('*')
    .in('key', ['contact_name', 'contact_title', 'contact_email']);

  const settings = (settingsData as TerminalSetting[]) ?? [];
  const settingsMap: Record<string, string> = {};
  for (const setting of settings) {
    settingsMap[setting.key] = String(setting.value ?? '');
  }

  // ---------- Fetch availability slots ----------
  const { data: slotsData } = await supabase
    .from('terminal_availability_slots')
    .select('*')
    .eq('is_active', true)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  const availabilitySlots = (slotsData as TerminalAvailabilitySlot[]) ?? [];

  // ---------- Fetch already-booked meetings ----------
  const { data: bookedMeetingsData } = await supabase
    .from('terminal_meetings')
    .select('scheduled_at')
    .eq('deal_id', id)
    .in('status', ['scheduled']);

  const bookedTimes: string[] = (bookedMeetingsData ?? []).map(
    (m: { scheduled_at: string }) => m.scheduled_at
  );

  // ---------- Fetch portfolio addresses (for Portfolio Properties + OM dropdown) ----------
  const { data: addressesData } = await supabase
    .from('terminal_deal_addresses')
    .select('id, label, address, city, state, square_footage, units, display_order')
    .eq('deal_id', id)
    .order('display_order', { ascending: true });

  // Deal-level + per-address document slots live in terminal_dd_documents (the
  // single source of truth), keyed by the fixed slot `name`.
  const { data: slotDocs } = await supabase
    .from('terminal_dd_documents')
    .select('name, storage_path')
    .eq('deal_id', id);
  const slotPathByName = new Map<string, string>(
    (slotDocs ?? [])
      .filter((d): d is { name: string; storage_path: string } => !!d.storage_path)
      .map((d) => [d.name, d.storage_path]),
  );

  const addresses = ((addressesData ?? []) as {
    id: string;
    label: string;
    address: string | null;
    city: string | null;
    state: string | null;
    square_footage: string | null;
    units: string | null;
  }[]).map((a) => ({
    ...a,
    om_storage_path: slotPathByName.get(`offering-memorandum-${a.id.slice(0, 8)}`) ?? null,
  }));

  // ---------- Fetch tenant rent roll ----------
  const { data: tenantsData } = await supabase
    .from('tenant_leases')
    .select('*')
    .eq('deal_id', id)
    .order('sort_order', { ascending: true });

  const tenants = (tenantsData ?? []) as TerminalTenantLease[];

  // ---------- Fetch CapEx items ----------
  const { data: capexData } = await supabase
    .from('capex_items')
    .select('*')
    .eq('deal_id', id)
    .order('sort_order', { ascending: true });

  const capexItems = (capexData ?? []) as CapExItem[];

  // ---------- Fetch exit scenarios ----------
  const { data: exitScenariosData } = await supabase
    .from('exit_scenarios')
    .select('*')
    .eq('deal_id', id)
    .order('sort_order', { ascending: true });

  const exitScenarios = (exitScenariosData ?? []) as ExitScenario[];

  // ---------- Fetch insights ----------
  const { data: insightsData } = await supabase
    .from('terminal_deal_insights')
    .select('*, category:terminal_insight_categories(id, name, display_name)')
    .eq('deal_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const insights = (insightsData ?? []) as DealInsight[];

  // ---------- Prev/Next deal navigation (admin preview includes drafts) ----------
  const ADMIN_STATUS_ORDER: Record<string, number> = {
    draft: -1, coming_soon: 0,
    psa_signed: 1, loi_signed: 2, pending_final_loi: 3, published: 4,
    assigned: 5, closed: 6, cancelled: 7,
  };
  const { data: navDealsData } = await supabase
    .from('terminal_deals')
    .select('id, name, status, dd_deadline')
    .in('status', [...ACTIVE_DEAL_STATUSES, 'draft', 'coming_soon', 'marketplace', 'investor_only', 'assigned', 'closed', 'cancelled'])
    .order('created_at', { ascending: false });

  const navDeals = (navDealsData ?? []).slice().sort((a, b) => {
    const orderA = ADMIN_STATUS_ORDER[a.status] ?? 4;
    const orderB = ADMIN_STATUS_ORDER[b.status] ?? 4;
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

  // ---------- Build deal with details ----------
  const dealWithDetails: DealWithDetails = {
    ...deal,
    // Overlay deal-level document slots from terminal_dd_documents.
    om_storage_path: slotPathByName.get('offering-memorandum') ?? null,
    loi_signed_storage_path: slotPathByName.get('loi-signed') ?? null,
    psa_storage_path: slotPathByName.get('purchase-sale-agreement') ?? null,
    full_report_storage_path: slotPathByName.get('full-report') ?? null,
    costar_report_storage_path: slotPathByName.get('costar-report') ?? null,
    tenants_report_storage_path: slotPathByName.get('tenants-report') ?? null,
    lease_summary_storage_path: slotPathByName.get('lease-summary') ?? null,
    photos,
    dd_folders: foldersWithDocs,
    viewing_count: viewingCount ?? 0,
    meetings_count: meetingsCount ?? 0,
  };

  // ---------- Resolve fees (admin preview shows REPRIME terms; no investor overrides)
  const globalFeeDefaults = await getGlobalFeeDefaults(supabase);
  const resolvedDealFees = resolveAllFees(
    deal as unknown as Record<string, unknown>,
    globalFeeDefaults,
  );
  const resolvedInvestorTerms = resolveInvestorTerms(null, globalFeeDefaults);

  return (
    <div className="min-h-screen bg-[#060D1B]">
      {/* Admin Preview Banner */}
      <div className="bg-[#0E3470] border-b border-[#BC9C45]/30 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-[1.5px] uppercase text-[#BC9C45]">
            {t('adminPreview')}
          </span>
          <span className="text-[12px] text-white/70">
            {t('viewingAsInvestor')}
          </span>
        </div>
        <a
          href={`/${locale}/admin/deals/${id}`}
          className="px-4 py-1.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[12px] font-semibold rounded-lg transition-colors"
        >
          {t('backToAdmin')}
        </a>
      </div>

      <DealDetailClient
        deal={dealWithDetails}
        photoUrls={photoUrls}
        contactName={settingsMap.contact_name ?? ''}
        contactTitle={settingsMap.contact_title ?? ''}
        contactEmail={settingsMap.contact_email ?? ''}
        availabilitySlots={availabilitySlots}
        bookedTimes={bookedTimes}
        locale={locale}
        addresses={addresses}
        tenants={tenants}
        capexItems={capexItems}
        exitScenarios={exitScenarios}
        insights={insights}
        prevDeal={prevDeal}
        nextDeal={nextDeal}
        previewMode
        hasSignedNDA
        globalFeeDefaults={globalFeeDefaults}
        resolvedDealFees={resolvedDealFees}
        resolvedInvestorTerms={resolvedInvestorTerms}
      />
    </div>
  );
}
