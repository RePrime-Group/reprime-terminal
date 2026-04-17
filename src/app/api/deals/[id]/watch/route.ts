import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getInvestorAuth, permissionDenied } from '@/lib/auth/requireInvestor';

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('terminal_watchlist')
    .select('id, frequency, channels, alert_types')
    .eq('deal_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ watching: !!data, watchlist: data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const authResult = await getInvestorAuth();
  if (!authResult.ok) return authResult.response;
  const denied = permissionDenied(authResult.user, 'manage_watchlist');
  if (denied) return denied;
  const user = { id: authResult.user.userId };

  const body = await request.json().catch(() => ({}));

  const { error } = await supabase
    .from('terminal_watchlist')
    .upsert({
      deal_id: id,
      user_id: user.id,
      frequency: body.frequency || 'every',
      channels: body.channels || { email: true, whatsapp: false, sms: false },
      alert_types: body.alert_types || { docs: true, deadlines: true, price: true, competing: true },
    }, { onConflict: 'user_id,deal_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watching: true }, { status: 201 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const authResult = await getInvestorAuth();
  if (!authResult.ok) return authResult.response;
  const denied = permissionDenied(authResult.user, 'manage_watchlist');
  if (denied) return denied;
  const user = { id: authResult.user.userId };

  await supabase.from('terminal_watchlist').delete().eq('deal_id', id).eq('user_id', user.id);
  return NextResponse.json({ watching: false });
}
