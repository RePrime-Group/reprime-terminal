import { redirect } from 'next/navigation';
import { getCurrentAuthUser, getCurrentProfile } from '@/lib/supabase/currentUser';
import PortalNavbar from '@/components/portal/PortalNavbar';
import MarketTicker from '@/components/portal/MarketTicker';

// Investor-style shell used by /admin/preview/* — renders the same MarketTicker
// + PortalNavbar an investor sees so the admin gets a faithful preview, but
// passes previewMode to the navbar so all writes are gated and tabs that have
// no preview equivalent are hidden. No admin sidebar; the BetaLaunchBanner is
// also omitted to keep the chrome focused on what investors see.
export const metadata = { title: 'Investor Preview — RePrime Terminal Beta Admin' };

export default async function AdminPreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [user, terminalUser] = await Promise.all([
    getCurrentAuthUser(),
    getCurrentProfile(),
  ]);

  if (!user) redirect(`/${locale}/login`);
  if (!terminalUser) redirect(`/${locale}/login`);
  if (terminalUser.role === 'investor') redirect(`/${locale}/portal`);

  return (
    <div className="min-h-dvh">
      <MarketTicker />
      <PortalNavbar
        firstName={terminalUser.full_name?.split(' ')[0] ?? ''}
        fullName={terminalUser.full_name ?? ''}
        email={user.email ?? ''}
        locale={locale}
        previewMode
      />
      <main>{children}</main>
    </div>
  );
}
