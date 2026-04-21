import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Sidebar-free admin shell used only by the /admin/preview routes. The admin
// previews what an investor sees, so we deliberately do NOT render the admin
// sidebar or BetaLaunchBanner here — each preview page renders its own
// "Admin Preview" banner so the back-link can be page-specific.
export const metadata = { title: 'Investor Preview — RePrime Terminal Beta Admin' };

export default async function AdminPreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login`);

  const { data: terminalUser } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!terminalUser) redirect(`/${locale}/login`);
  if (terminalUser.role === 'investor') redirect(`/${locale}/portal`);

  return <>{children}</>;
}
