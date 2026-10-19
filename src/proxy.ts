import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = ['/login', '/invite', '/join', '/welcome', '/forgot-password', '/reset-password', '/deal', '/criteria', '/unsubscribe'];

function getPathWithoutLocale(pathname: string): string {
  return pathname.replace(/^\/(en|he)/, '') || '/';
}

function getLocale(pathname: string): string {
  return pathname.match(/^\/(en|he)/)?.[1] || 'en';
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathWithoutLocale = getPathWithoutLocale(pathname);

  // Run intl middleware first to get a response with locale headers/redirects
  const intlResponse = intlMiddleware(request);

  // Start from intlResponse so locale cookies/headers are preserved,
  // but we need a mutable NextResponse to attach Supabase cookie writes.
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Copy over intl middleware headers and cookies
  intlResponse.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });
  intlResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value);
  });

  // If intl middleware wants to redirect (e.g. adding locale prefix), let it
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  // Public paths — no auth check needed
  if (PUBLIC_PATHS.some((p) => pathWithoutLocale.startsWith(p))) {
    return response;
  }

  // Root landing ("/") is public — shows launch countdown for unauthenticated
  // visitors; the page component redirects authenticated users to portal/admin.
  if (pathWithoutLocale === '/' || pathWithoutLocale === '') {
    return response;
  }

  // Create Supabase client with proper cookie handling for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getClaims() verifies the access token and refreshes the session; the
  // refreshed tokens are written back via setAll above. Once the project uses
  // asymmetric JWT signing keys it verifies the signature locally against the
  // cached JWKS, with no round trip to the Auth server (~300ms saved on every
  // navigation). Until that rotation happens it transparently falls back to a
  // server call, so this is safe to ship ahead of the migration.
  // Note: a signed-out visitor yields { data: null, error: null }, which is not
  // an error condition — treat any absent `sub` as unauthenticated.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (!userId) {
    const locale = getLocale(pathname);
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Account language: LanguageSwitcher saves the user's choice in
  // user_metadata.locale. Keep them in it on every page, device and emailed
  // link (e.g. /en/... deal notifications). Users who never chose have no
  // value and stay on whatever locale the URL carries. Admin pages have no
  // switcher, so they keep following the URL.
  const preferredLocale = claimsData?.claims.user_metadata?.locale;
  if (
    !pathWithoutLocale.startsWith('/admin') &&
    routing.locales.includes(preferredLocale) &&
    preferredLocale !== getLocale(pathname)
  ) {
    const localeUrl = request.nextUrl.clone();
    localeUrl.pathname = `/${preferredLocale}${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`;
    const redirect = NextResponse.redirect(localeUrl);
    // Keep any refreshed Supabase session cookies, and point next-intl's
    // cookie at the preferred locale instead of the one from the old URL.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.cookies.set('NEXT_LOCALE', preferredLocale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return redirect;
  }

  // Fetch user role + tier
  const { data: terminalUser } = await supabase
    .from('terminal_users')
    .select('role, access_tier')
    .eq('id', userId)
    .single();

  if (!terminalUser) {
    const locale = getLocale(pathname);
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  const role = terminalUser.role;
  const accessTier = terminalUser.access_tier as 'investor' | 'marketplace_only' | null;
  const locale = getLocale(pathname);

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

    // Marketplace-only investors: lock down everything except Marketplace,
    // Settings, Profile, and individual marketplace deal detail pages.
    if (accessTier === 'marketplace_only') {
      const allowedPrefixes = ['/portal/marketplace', '/portal/settings', '/portal/profile'];
      const dealMatch = pathWithoutLocale.match(/^\/portal\/deals\/([^/]+)/);
      if (dealMatch) {
        const dealId = dealMatch[1];
        const { data: deal } = await supabase
          .from('terminal_deals')
          .select('status')
          .eq('id', dealId)
          .maybeSingle();
        if (!deal || deal.status !== 'marketplace') {
          return NextResponse.redirect(new URL(`/${locale}/portal/marketplace`, request.url));
        }
      } else if (!allowedPrefixes.some((p) => pathWithoutLocale.startsWith(p))) {
        return NextResponse.redirect(new URL(`/${locale}/portal/marketplace`, request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|images/|api/)(?!.*\\.[\\w]+$).*)',
  ],
};
