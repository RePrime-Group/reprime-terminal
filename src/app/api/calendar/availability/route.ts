import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getBusyTimes } from '@/lib/google/calendar';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get date range from query params (default: next 7 days)
  const start = request.nextUrl.searchParams.get('start')
    || new Date().toISOString();
  const end = request.nextUrl.searchParams.get('end')
    || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const busyTimes = await getBusyTimes(start, end);
    return NextResponse.json({ busyTimes });
  } catch (err) {
    console.error('Calendar availability error:', err);
    // If Google Calendar isn't configured, return empty (fall back to DB slots)
    return NextResponse.json({ busyTimes: [] });
  }
}
