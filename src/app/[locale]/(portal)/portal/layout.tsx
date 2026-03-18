import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PortalNavbar from '@/components/portal/PortalNavbar';

export default async function PortalLayout({
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
    .select('*')
    .eq('id', user.id)
    .single();

  if (!terminalUser) redirect(`/${locale}/login`);
  if (terminalUser.role !== 'investor') redirect(`/${locale}/admin`);

  return (
    <div className="min-h-screen rp-page-texture">
      <PortalNavbar
        firstName={terminalUser.first_name}
        locale={locale}
      />
      <main>
        {children}
      </main>
    </div>
  );
}
