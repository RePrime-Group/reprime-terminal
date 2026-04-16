import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizePrefs, type NotifPreferences } from '@/lib/notifications/types';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('terminal_users')
    .select('notification_preferences')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ prefs: normalizePrefs(data?.notification_preferences) });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  // normalizePrefs fills any missing fields with defaults, so this already has full shape.
  const merged: NotifPreferences = normalizePrefs(body?.prefs);

  const { error } = await supabase
    .from('terminal_users')
    .update({ notification_preferences: merged })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prefs: merged });
}