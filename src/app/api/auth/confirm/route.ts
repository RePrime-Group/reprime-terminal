import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Handles the GET that happens when a user clicks the link in a password-reset
// (or other email OTP) email. We verify server-side so the session is written
// into HTTP cookies before we redirect to the UI — this avoids relying on
// Supabase's "Redirect URLs" allow-list for local/custom hosts, and keeps the
// raw token off the client.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as
    | 'recovery'
    | 'signup'
    | 'invite'
    | 'magiclink'
    | 'email_change'
    | null;
  const next = url.searchParams.get('next') || '/';

  const redirectTo = (query: string) => {
    const dest = new URL(next, url.origin);
    if (query) dest.search = query;
    return NextResponse.redirect(dest);
  };

  if (!token_hash || !type) {
    return redirectTo('error=invalid');
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    console.error('auth/confirm: verifyOtp failed', error);
    return redirectTo('error=expired');
  }

  return redirectTo('');
}
