import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import DealDetailClient from '@/components/portal/DealDetailClient';
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
    .select('id, label, address, city, state, square_footage, units, om_storage_path, display_order')
    .eq('deal_id', id)
    .order('display_order', { ascending: true });

  const addresses = (addressesData ?? []) as {
    id: string;
    label: string;
    address: string | null;
    city: string | null;
    state: string | null;
    square_footage: string | null;
    units: string | null;
    om_storage_path: string | null;
  }[];

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

  // ---------- Build deal with details ----------
  const dealWithDetails: DealWithDetails = {
    ...deal,
    photos,
    dd_folders: foldersWithDocs,
    viewing_count: viewingCount ?? 0,
    meetings_count: meetingsCount ?? 0,
  };

  return (
    <div className="min-h-screen bg-[#060D1B]">
      {/* Admin Preview Banner */}
      <div className="sticky top-0 z-50 bg-[#0E3470] border-b border-[#BC9C45]/30 text-white px-6 py-3 flex items-center justify-between">
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
        previewMode
        hasSignedNDA
      />
    </div>
  );
}
