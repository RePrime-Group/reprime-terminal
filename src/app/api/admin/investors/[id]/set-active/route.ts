import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminAuth } from '@/lib/auth/requireAdmin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await getAdminAuth();
  if (!authResult.ok) return authResult.response;

  const body = await request.json();
  const isActive = body?.is_active === true;

  const admin = createAdminClient();
  const { error } = await admin
    .from('terminal_users')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    console.error('[admin/investors/set-active] failed:', error);
    return NextResponse.json(
      { error: 'Failed to update user status.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, is_active: isActive });
}
