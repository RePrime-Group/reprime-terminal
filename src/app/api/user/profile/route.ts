import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('terminal_users')
    .select('full_name, email, phone, company_name')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    profile: {
      full_name: data?.full_name ?? '',
      email: data?.email ?? user.email ?? '',
      phone: data?.phone ?? '',
      company_name: data?.company_name ?? '',
    },
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, string | null> = {};

  if (typeof body.full_name === 'string') {
    const v = body.full_name.trim();
    if (v.length === 0) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    update.full_name = v;
  }
  if (typeof body.phone === 'string') {
    update.phone = body.phone.trim() || null;
  }
  if (typeof body.company_name === 'string') {
    update.company_name = body.company_name.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const { error } = await supabase
    .from('terminal_users')
    .update(update)
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}