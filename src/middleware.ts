import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = ['/login', '/invite'];

function getPathWithoutLocale(pathname: string): string {
  return pathname.replace(/^\/(en|he)/, '') || '/';
}

function getLocale(pathname: string): string {
  return pathname.match(/^\/(en|he)/)?.[1] || 'en';
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathWithoutLocale = getPathWithoutLocale(pathname);

  // Let intl middleware handle locale detection/redirect for all paths
  const response = intlMiddleware(request);

  // Public paths — no auth check needed
  if (PUBLIC_PATHS.some((p) => pathWithoutLocale.startsWith(p))) {
    return response;
  }

  // Extract the Supabase auth token from cookies
  // Supabase stores the session in a cookie named sb-<project-ref>-auth-token
  // It may be chunked across multiple cookies (sb-...-auth-token.0, .1, etc.)
  const cookieEntries = request.cookies.getAll();
  let accessToken: string | null = null;

  // Look for the base64-encoded session cookie(s)
  const authCookieName = cookieEntries
    .map((c) => c.name)
    .find((name) => name.startsWith('sb-') && name.endsWith('-auth-token'));

  if (authCookieName) {
    // Single cookie
    const raw = request.cookies.get(authCookieName)?.value;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        accessToken = parsed.access_token || parsed[0]?.access_token || null;
      } catch {
        accessToken = null;
      }
    }
  }

  // Check for chunked cookies (sb-...-auth-token.0, .1, etc.)
  if (!accessToken) {
    const chunkPrefix = cookieEntries
      .map((c) => c.name)
      .find((name) => name.startsWith('sb-') && name.includes('-auth-token.0'));

    if (chunkPrefix) {
      const baseName = chunkPrefix.replace('.0', '');
      const chunks: string[] = [];
      let i = 0;
      while (true) {
        const chunk = request.cookies.get(`${baseName}.${i}`)?.value;
        if (!chunk) break;
        chunks.push(chunk);
        i++;
      }
      if (chunks.length > 0) {
        try {
          const parsed = JSON.parse(chunks.join(''));
          accessToken = parsed.access_token || parsed[0]?.access_token || null;
        } catch {
          accessToken = null;
        }
      }
    }
  }

  // No token — redirect to login
  if (!accessToken) {
    const locale = getLocale(pathname);
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify the token with Supabase using the lightweight JS client (Edge-compatible)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    const locale = getLocale(pathname);
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Fetch user role
  const { data: terminalUser } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!terminalUser) {
    const locale = getLocale(pathname);
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  const role = terminalUser.role;
  const locale = getLocale(pathname);

  // Root redirect based on role
  if (pathWithoutLocale === '/' || pathWithoutLocale === '') {
    if (role === 'investor') {
      return NextResponse.redirect(new URL(`/${locale}/portal`, request.url));
    }
    return NextResponse.redirect(new URL(`/${locale}/admin`, request.url));
  }

  // Admin route protection
  if (pathWithoutLocale.startsWith('/admin')) {
    if (role === 'investor') {
      return NextResponse.redirect(new URL(`/${locale}/portal`, request.url));
    }
    const ownerOnlyPaths = ['/admin/investors', '/admin/activity', '/admin/settings'];
    if (role === 'employee' && ownerOnlyPaths.some((p) => pathWithoutLocale.startsWith(p))) {
      return NextResponse.redirect(new URL(`/${locale}/admin/deals`, request.url));
    }
  }

  // Portal route protection
  if (pathWithoutLocale.startsWith('/portal')) {
    if (role !== 'investor') {
      return NextResponse.redirect(new URL(`/${locale}/admin`, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - images/ (public images)
     * - api/ (API routes)
     * - Files with extensions (e.g. .svg, .png, .css, .js)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|images/|api/)(?!.*\\.[\\w]+$).*)',
  ],
};
