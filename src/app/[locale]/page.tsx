import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LaunchCountdownSplash from '@/components/login/LaunchCountdownSplash';

export default async function RootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Unauthenticated visitors land on the beta-launch splash.
  if (!user) {
    return <LaunchCountdownSplash locale={locale} />;
  }

  const { data: terminalUser } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!terminalUser) {
    redirect(`/${locale}/login`);
  }

  if (terminalUser.role === 'investor') {
    redirect(`/${locale}/portal`);
  }

  redirect(`/${locale}/admin`);
}
