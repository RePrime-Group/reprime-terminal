import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import DealPreviewClient from '@/components/preview/DealPreviewClient';
import { formatPrice, formatPercent } from '@/lib/utils/format';

interface DealPreviewPageProps {
  params: Promise<{ locale: string; id: string }>;
}

const PREVIEW_STATUSES = ['published', 'loi_signed', 'marketplace'] as const;

const PREVIEW_DEAL_COLUMNS = [
  'id', 'name', 'address', 'city', 'state',
  'property_type', 'class_type', 'square_footage', 'units',
  'purchase_price', 'equity_required',
  'cap_rate', 'noi', 'dscr', 'occupancy',
  'seller_financing', 'note_sale', 'status',
].join(', ');

const SUGGESTED_DEAL_COLUMNS = [
  'id', 'name', 'city', 'state', 'property_type',
  'purchase_price', 'cap_rate', 'status', 'created_at',
].join(', ');

export async function generateMetadata({ params }: DealPreviewPageProps): Promise<Metadata> {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: deal } = await admin
    .from('terminal_deals')
    .select('name, city, state, property_type, purchase_price, cap_rate, status')
    .eq('id', id)
    .in('status', PREVIEW_STATUSES as unknown as string[])
    .maybeSingle();

  if (!deal) {
    return { title: 'Deal — RePrime Terminal' };
  }

  const { data: photo } = await admin
    .from('terminal_deal_photos')
    .select('storage_path')
    .eq('deal_id', id)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  let ogImage: string | undefined;
  if (photo?.storage_path) {
    const { data } = admin.storage
      .from('terminal-deal-photos')
      .getPublicUrl(photo.storage_path);
    ogImage = data.publicUrl;
  }

  const title = `${deal.name} — RePrime Terminal`;
  const descParts = [
    deal.purchase_price ? formatPrice(deal.purchase_price) : null,
    deal.cap_rate ? `${formatPercent(deal.cap_rate)} Cap Rate` : null,
    deal.property_type,
    [deal.city, deal.state].filter(Boolean).join(', ') || null,
  ].filter(Boolean);
  const description = descParts.join(' · ');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function DealPreviewPage({ params }: DealPreviewPageProps) {
  const { locale, id } = await params;

  // Auth check uses the user-scoped client (reads cookies). If the visitor is
  // signed in, send them to the full investor experience.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect(`/${locale}/portal/deals/${id}`);
  }

  // Public preview data is fetched with the service-role client to bypass RLS
  // (which gates terminal_deals/photos/tenants on user role). The page enforces
  // its own status allowlist and column allowlist below; nothing beyond that is
  // exposed.
  const admin = createAdminClient();

  const { data: dealData } = await admin
    .from('terminal_deals')
    .select(PREVIEW_DEAL_COLUMNS)
    .eq('id', id)
    .in('status', PREVIEW_STATUSES as unknown as string[])
    .maybeSingle();

  if (!dealData) {
    redirect(`/${locale}`);
  }

  const deal = dealData as unknown as Record<string, unknown>;

  const [
    { data: photosData },
    { count: tenantCount },
    { data: suggestedDealsRaw },
  ] = await Promise.all([
    admin
      .from('terminal_deal_photos')
      .select('storage_path, display_order')
      .eq('deal_id', id)
      .order('display_order', { ascending: true }),
    admin
      .from('tenant_leases')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', id),
    admin
      .from('terminal_deals')
      .select(SUGGESTED_DEAL_COLUMNS)
      .eq('status', 'published')
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const suggestedDealsData = (suggestedDealsRaw ?? []) as unknown as Array<{
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    property_type: string | null;
    purchase_price: string | number | null;
    cap_rate: string | number | null;
  }>;

  const photoUrls = (photosData ?? []).map((photo) => {
    const { data } = admin.storage
      .from('terminal-deal-photos')
      .getPublicUrl(photo.storage_path);
    return data.publicUrl;
  });

  const suggestedDeals = await Promise.all(
    suggestedDealsData.map(async (s) => {
      const { data: photo } = await admin
        .from('terminal_deal_photos')
        .select('storage_path')
        .eq('deal_id', s.id)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      const photoUrl = photo?.storage_path
        ? admin.storage.from('terminal-deal-photos').getPublicUrl(photo.storage_path).data.publicUrl
        : null;
      return {
        id: s.id,
        name: s.name,
        city: s.city,
        state: s.state,
        property_type: s.property_type,
        purchase_price: s.purchase_price,
        cap_rate: s.cap_rate,
        photo_url: photoUrl,
      };
    }),
  );

  return (
    <DealPreviewClient
      locale={locale}
      deal={{
        id: deal.id as string,
        name: deal.name as string,
        address: deal.address as string | null,
        city: deal.city as string | null,
        state: deal.state as string | null,
        property_type: deal.property_type as string | null,
        class_type: deal.class_type as string | null,
        square_footage: deal.square_footage as string | number | null,
        units: deal.units as string | number | null,
        purchase_price: deal.purchase_price as string | number | null,
        equity_required: deal.equity_required as string | number | null,
        cap_rate: deal.cap_rate as string | number | null,
        noi: deal.noi as string | number | null,
        dscr: deal.dscr as string | number | null,
        occupancy: deal.occupancy as string | number | null,
        seller_financing: deal.seller_financing as boolean | null,
        note_sale: deal.note_sale as boolean | null,
        status: deal.status as string,
      }}
      photoUrls={photoUrls}
      tenantCount={tenantCount ?? 0}
      suggestedDeals={suggestedDeals}
    />
  );
}
