import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function RootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
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
