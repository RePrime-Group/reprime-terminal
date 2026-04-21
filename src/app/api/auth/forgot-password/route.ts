import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPasswordResetEmail } from '@/lib/email/send';

export async function POST(request: NextRequest) {
  let payload: { email?: string; locale?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const locale = payload.locale === 'he' ? 'he' : 'en';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  // Always respond with success to avoid leaking whether an email is registered.
  // If no matching user is found, simply skip sending the email.
  const supabase = createAdminClient();

  const { data: userRow } = await supabase
    .from('terminal_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!userRow) {
    return NextResponse.json({ success: true });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(request.url).origin;

  const nextPath = `/${locale}/reset-password`;

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${siteUrl}${nextPath}` },
  });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    console.error('forgot-password: generateLink failed', linkError);
    return NextResponse.json(
      { error: 'We couldn’t start the password reset. Please try again shortly.' },
      { status: 500 },
    );
  }

  // Route the email link through our own server so verification happens with
  // server-side cookies — this sidesteps Supabase's Redirect URLs allow-list
  // for local/custom origins and lets us land the user directly on the reset
  // page (or a friendly "expired" state) instead of Supabase's site URL.
  const confirmUrl =
    `${siteUrl}/api/auth/confirm` +
    `?token_hash=${encodeURIComponent(hashedToken)}` +
    `&type=recovery` +
    `&next=${encodeURIComponent(nextPath)}`;

  try {
    await sendPasswordResetEmail(email, confirmUrl, 60);
  } catch (err) {
    console.error('forgot-password: email send failed', err);
    return NextResponse.json(
      { error: 'We couldn’t send the reset email. Please try again shortly.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
