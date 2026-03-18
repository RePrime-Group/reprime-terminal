import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DealDetailClient from '@/components/portal/DealDetailClient';
import type {
  TerminalDeal,
  TerminalDealPhoto,
  TerminalDDFolder,
  TerminalDDDocument,
  TerminalAvailabilitySlot,
  TerminalSetting,
  DealWithDetails,
} from '@/lib/types/database';

interface DealDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Fetch deal - only published, assigned, or closed deals are visible
  const { data: dealData } = await supabase
    .from('terminal_deals')
    .select('*')
    .eq('id', id)
    .in('status', ['published', 'assigned', 'closed'])
    .single();

  if (!dealData) {
    redirect(`/${locale}/portal`);
  }

  const deal = dealData as TerminalDeal;

  // Fetch photos ordered by display_order
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

  // Fetch DD folders with their documents
  const { data: foldersData } = await supabase
    .from('terminal_dd_folders')
    .select('*')
    .eq('deal_id', id)
    .order('display_order', { ascending: true });

  const folders = (foldersData as TerminalDDFolder[]) ?? [];

  // Fetch documents for each folder
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

  // Fetch viewing count (unique users who viewed this deal)
  const { count: viewingCount } = await supabase
    .from('terminal_activity_log')
    .select('user_id', { count: 'exact', head: true })
    .eq('deal_id', id)
    .eq('action', 'deal_viewed');

  // Fetch meetings count
  const { count: meetingsCount } = await supabase
    .from('terminal_meetings')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', id)
    .in('status', ['scheduled', 'completed']);

  // Fetch settings (contact info)
  const { data: settingsData } = await supabase
    .from('terminal_settings')
    .select('*')
    .in('key', ['contact_name', 'contact_title', 'contact_email']);

  const settings = (settingsData as TerminalSetting[]) ?? [];
  const settingsMap: Record<string, string> = {};
  for (const setting of settings) {
    settingsMap[setting.key] = String(setting.value ?? '');
  }

  // Fetch availability slots
  const { data: slotsData } = await supabase
    .from('terminal_availability_slots')
    .select('*')
    .eq('is_active', true)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  const availabilitySlots = (slotsData as TerminalAvailabilitySlot[]) ?? [];

  // Fetch already-booked meetings for this deal to exclude those times
  const { data: bookedMeetingsData } = await supabase
    .from('terminal_meetings')
    .select('scheduled_at')
    .eq('deal_id', id)
    .in('status', ['scheduled']);

  const bookedTimes: string[] = (bookedMeetingsData ?? []).map(
    (m: { scheduled_at: string }) => m.scheduled_at
  );

  const dealWithDetails: DealWithDetails = {
    ...deal,
    photos,
    dd_folders: foldersWithDocs,
    viewing_count: viewingCount ?? 0,
    meetings_count: meetingsCount ?? 0,
  };

  return (
    <DealDetailClient
      deal={dealWithDetails}
      photoUrls={photoUrls}
      contactName={settingsMap.contact_name ?? ''}
      contactTitle={settingsMap.contact_title ?? ''}
      contactEmail={settingsMap.contact_email ?? ''}
      availabilitySlots={availabilitySlots}
      bookedTimes={bookedTimes}
      locale={locale}
    />
  );
}
