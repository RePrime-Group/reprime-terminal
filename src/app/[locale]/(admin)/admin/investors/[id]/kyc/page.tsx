import { redirect } from 'next/navigation';

// KYC was removed as a Terminal access requirement. The detailed review page
// is dormant; old links bounce back to the investor list. The DB rows
// (terminal_user_kyc) are preserved for grandfathered records, so this page
// can be revived by reverting this stub if KYC is re-introduced.
export default async function AdminKYCReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/admin/investors`);
}

export const dynamic = 'force-dynamic';
