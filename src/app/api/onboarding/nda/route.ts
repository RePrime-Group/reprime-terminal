import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface SignNDABody {
  fullName?: string;
  company?: string | null;
  title?: string | null;
}

function getClientIP(h: Headers): string | null {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return h.get('x-real-ip');
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only investors go through onboarding NDA. Owners/employees don't need it.
  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'investor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as SignNDABody;
  const fullName = body.fullName?.trim();
  if (!fullName) return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });

  const h = await headers();
  const ip = getClientIP(h);

  // If they've already signed a blanket NDA, treat the request as a no-op.
  const { data: existing } = await supabase
    .from('terminal_nda_signatures')
    .select('id')
    .eq('user_id', user.id)
    .eq('nda_type', 'blanket')
    .limit(1);
  if ((existing?.length ?? 0) > 0) return NextResponse.json({ ok: true, alreadySigned: true });

  const { error } = await supabase.from('terminal_nda_signatures').insert({
    user_id: user.id,
    nda_type: 'blanket',
    signer_name: fullName,
    signer_company: body.company?.trim() || null,
    signer_title: body.title?.trim() || null,
    ip_address: ip,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
