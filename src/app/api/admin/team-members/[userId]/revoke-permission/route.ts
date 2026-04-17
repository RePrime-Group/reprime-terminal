import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminAuth } from '@/lib/auth/requireAdmin';
import { APPROVAL_REQUIRED_KEYS, normalizePermissions } from '@/lib/auth/permissions';
import type { TeamPermissionKey } from '@/lib/types/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const authResult = await getAdminAuth();
  if (!authResult.ok) return authResult.response;

  const body = await request.json();
  const permissionKey: unknown = body?.permission_key;

  if (typeof permissionKey !== 'string' || !APPROVAL_REQUIRED_KEYS.includes(permissionKey as TeamPermissionKey)) {
    return NextResponse.json({ error: 'Invalid permission key.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('terminal_users')
    .select('id, permissions, parent_investor_id')
    .eq('id', userId)
    .single();

  if (!target || !target.parent_investor_id) {
    return NextResponse.json({ error: 'Target is not a team member.' }, { status: 400 });
  }

  const current = normalizePermissions(target.permissions);
  current[permissionKey as TeamPermissionKey] = false;

  const { error: updErr } = await admin
    .from('terminal_users')
    .update({ permissions: current })
    .eq('id', userId);
  if (updErr) {
    console.error('[admin/revoke-permission] update failed:', updErr);
    return NextResponse.json({ error: 'Failed to revoke permission.' }, { status: 500 });
  }

  // Reset prior approvals so re-enabling requires a new request
  await admin
    .from('terminal_team_requests')
    .update({
      status: 'rejected',
      reviewed_by: authResult.user.userId,
      reviewed_at: new Date().toISOString(),
      admin_notes: 'Revoked by admin',
    })
    .eq('target_user_id', userId)
    .eq('permission_key', permissionKey)
    .eq('status', 'approved');

  // Notify the parent investor
  await admin.from('terminal_notifications').insert({
    user_id: target.parent_investor_id,
    type: 'team_permission_revoked',
    title: `A team permission was revoked by admin`,
    description: `The ${permissionKey.replace(/_/g, ' ')} permission has been revoked. Submit a new request if it's needed again.`,
  });

  return NextResponse.json({ success: true });
}
