import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAdminAuth } from '@/lib/auth/requireAdmin';
import { getAuthUrl, getDriveRedirectUri } from '@/lib/google/drive';

export const runtime = 'nodejs';

// GET /api/integrations/google-drive/connect?locale=en
// Admin-only. Starts the OAuth consent flow for the single org-wide account.
export async function GET(req: NextRequest) {
  const auth = await getAdminAuth();
  if (!auth.ok) return auth.response;

  const locale = req.nextUrl.searchParams.get('locale') === 'he' ? 'he' : 'en';
  const nonce = randomUUID();
  // state = CSRF nonce + return locale, verified against the cookie in callback.
  const state = Buffer.from(JSON.stringify({ nonce, locale })).toString('base64url');

  const res = NextResponse.redirect(getAuthUrl(state, getDriveRedirectUri(req)));
  res.cookies.set('gdrive_oauth_state', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 min to complete consent
  });
  return res;
}
