import createIntlMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = ['/login', '/invite', '/join', '/welcome', '/forgot-password', '/reset-password', '/deal'];

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

  // getUser() validates the token server-side and refreshes the session.
  // The refreshed tokens are written back via setAll above.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const locale = getLocale(pathname);
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Fetch user role + tier
  const { data: terminalUser } = await supabase
    .from('terminal_users')
    .select('role, access_tier')
    .eq('id', user.id)
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
