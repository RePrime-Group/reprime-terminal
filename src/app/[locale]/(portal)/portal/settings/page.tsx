import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizePrefs } from '@/lib/notifications/types';
import SettingsClient from '@/components/portal/SettingsClient';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data } = await supabase
    .from('terminal_users')
    .select('full_name, email, phone, company_name, notification_preferences')
    .eq('id', user.id)
    .single();

  return (
    <SettingsClient
      initialProfile={{
        full_name: data?.full_name ?? '',
        email: data?.email ?? user.email ?? '',
        phone: data?.phone ?? '',
        company_name: data?.company_name ?? '',
      }}
      initialPrefs={normalizePrefs(data?.notification_preferences)}
    />
  );
}