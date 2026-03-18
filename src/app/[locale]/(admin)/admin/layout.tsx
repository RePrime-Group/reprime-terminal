import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default async function AdminLayout({
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
  if (terminalUser.role === 'investor') redirect(`/${locale}/portal`);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar user={terminalUser} locale={locale} />
      <main className="flex-1 ml-[260px] bg-rp-page-bg min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
