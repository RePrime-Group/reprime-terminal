import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/auth/requireAdmin';
import { exchangeCodeAndSave, getDriveRedirectUri } from '@/lib/google/drive';

export const runtime = 'nodejs';

// GET /api/integrations/google-drive/callback
// Google redirects here after consent. Verifies CSRF state, exchanges the code
// for tokens, stores the org connection, then bounces back to Admin > Settings.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get('code');
  const stateRaw = params.get('state');
  const oauthError = params.get('error');

  // Decode locale early so every redirect lands on the right localized page.
  let locale: 'en' | 'he' = 'en';
  let nonce: string | null = null;
  if (stateRaw) {
    try {
      const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString());
      if (parsed.locale === 'he') locale = 'he';
      nonce = typeof parsed.nonce === 'string' ? parsed.nonce : null;
    } catch {
      // fall through — treated as bad state below
    }
  }

  const settingsUrl = (status: string) =>
    new URL(`/${locale}/admin/settings?gdrive=${status}`, req.nextUrl.origin);

  if (oauthError) return NextResponse.redirect(settingsUrl('denied'));

  // Only a signed-in admin may complete the connection.
  const auth = await getAdminAuth();
  if (!auth.ok) return NextResponse.redirect(settingsUrl('unauthorized'));

  // CSRF: the nonce in state must match the httpOnly cookie we set on connect.
  const cookieNonce = req.cookies.get('gdrive_oauth_state')?.value;
  if (!code || !nonce || !cookieNonce || nonce !== cookieNonce) {
    return NextResponse.redirect(settingsUrl('error'));
  }

  try {
    await exchangeCodeAndSave(code, auth.user.userId, getDriveRedirectUri(req));
  } catch {
    const res = NextResponse.redirect(settingsUrl('error'));
    res.cookies.delete('gdrive_oauth_state');
    return res;
  }

  const res = NextResponse.redirect(settingsUrl('connected'));
  res.cookies.delete('gdrive_oauth_state');
  return res;
}
