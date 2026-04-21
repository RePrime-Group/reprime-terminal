import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_ROLES = ['owner', 'employee', 'investor'] as const;
type Role = typeof ALLOWED_ROLES[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Owner-only
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (profile.id === id) {
    return NextResponse.json({ error: 'Cannot change your own role.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const role = body?.role as Role | undefined;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('terminal_users')
    .update({ role })
    .eq('id', id);

  if (error) {
    console.error('[admin/users/set-role] failed:', error);
    return NextResponse.json({ error: 'Failed to update user role.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, role });
}
