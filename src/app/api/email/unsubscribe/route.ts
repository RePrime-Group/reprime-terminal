import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';
import { normalizePrefs } from '@/lib/notifications/types';

async function applyOptOut(token: string) {
  const payload = verifyUnsubscribeToken(token);
  if (!payload) return { ok: false as const };

  const admin = createAdminClient();
  const { data, error: readErr } = await admin
    .from('terminal_users')
    .select('notification_preferences')
    .eq('id', payload.uid)
    .single();
  if (readErr || !data) return { ok: false as const };

  const prefs = normalizePrefs(data.notification_preferences);
  prefs.events[payload.cat] = false;

  const { error: writeErr } = await admin
    .from('terminal_users')
    .update({ notification_preferences: prefs })
    .eq('id', payload.uid);
  if (writeErr) return { ok: false as const };

  return { ok: true as const, cat: payload.cat };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t');
  if (!token) return NextResponse.redirect(new URL('/en/unsubscribe?status=invalid', request.url));

  const result = await applyOptOut(token);
  const url = new URL('/en/unsubscribe', request.url);
  if (result.ok) {
    url.searchParams.set('status', 'ok');
    url.searchParams.set('cat', result.cat);
  } else {
    url.searchParams.set('status', 'invalid');
  }
  return NextResponse.redirect(url);
}

// RFC 8058 one-click unsubscribe (Gmail/Yahoo "List-Unsubscribe-Post" target).
// Must return 200 with no body to be considered successful.
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t');
  if (!token) return new NextResponse(null, { status: 400 });
  const result = await applyOptOut(token);
  if (!result.ok) return new NextResponse(null, { status: 400 });
  return new NextResponse(null, { status: 200 });
}
