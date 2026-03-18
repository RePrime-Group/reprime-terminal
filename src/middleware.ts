import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = ['/login', '/invite'];

function isPublicPath(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(en|he)/, '') || '/';
  return PUBLIC_PATHS.some((p) => pathWithoutLocale.startsWith(p));
}

function getPathWithoutLocale(pathname: string): string {
  return pathname.replace(/^\/(en|he)/, '') || '/';
}

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  const pathname = request.nextUrl.pathname;
  const pathWithoutLocale = getPathWithoutLocale(pathname);

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return response;
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const locale = pathname.match(/^\/(en|he)/)?.[1] || 'en';
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: terminalUser } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!terminalUser) {
    const locale = pathname.match(/^\/(en|he)/)?.[1] || 'en';
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  const role = terminalUser.role;

  if (pathWithoutLocale === '/' || pathWithoutLocale === '') {
    const locale = pathname.match(/^\/(en|he)/)?.[1] || 'en';
    if (role === 'investor') {
      return NextResponse.redirect(new URL(`/${locale}/portal`, request.url));
    }
    return NextResponse.redirect(new URL(`/${locale}/admin`, request.url));
  }

  if (pathWithoutLocale.startsWith('/admin')) {
    if (role === 'investor') {
      const locale = pathname.match(/^\/(en|he)/)?.[1] || 'en';
      return NextResponse.redirect(new URL(`/${locale}/portal`, request.url));
    }

    const ownerOnlyPaths = ['/admin/investors', '/admin/activity', '/admin/settings'];
    if (role === 'employee' && ownerOnlyPaths.some((p) => pathWithoutLocale.startsWith(p))) {
      const locale = pathname.match(/^\/(en|he)/)?.[1] || 'en';
      return NextResponse.redirect(new URL(`/${locale}/admin/deals`, request.url));
    }
  }

  if (pathWithoutLocale.startsWith('/portal')) {
    if (role !== 'investor') {
      const locale = pathname.match(/^\/(en|he)/)?.[1] || 'en';
      return NextResponse.redirect(new URL(`/${locale}/admin`, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|api/).*)'],
};
