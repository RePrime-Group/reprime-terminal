import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminAuth } from '@/lib/auth/requireAdmin';
import { normalizePermissions } from '@/lib/auth/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authResult = await getAdminAuth();
  if (!authResult.ok) return authResult.response;

  const body = await request.json();
  const decision: unknown = body?.decision;
  const adminNotes: string | null = typeof body?.admin_notes === 'string' ? body.admin_notes.slice(0, 1000) : null;

  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: req } = await admin
    .from('terminal_team_requests')
    .select('id, investor_id, request_type, requested_total, target_user_id, permission_key, status')
    .eq('id', id)
    .single();

  if (!req) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  }
  if (req.status !== 'pending') {
    return NextResponse.json(
      { error: 'This request has already been reviewed.' },
      { status: 409 },
    );
  }

  const nextStatus = decision === 'approve' ? 'approved' : 'rejected';

  // Apply side effects before marking the row so we can still retry on failure.
  if (decision === 'approve') {
    if (req.request_type === 'invite_limit' && req.requested_total) {
      const { error: updErr } = await admin
        .from('terminal_users')
        .update({ team_invite_limit: req.requested_total })
        .eq('id', req.investor_id);
      if (updErr) {
        console.error('[admin/team-requests approve invite_limit] failed:', updErr);
        return NextResponse.json(
          { error: 'Failed to update invite limit.' },
          { status: 500 },
        );
      }
    } else if (req.request_type === 'permission' && req.target_user_id && req.permission_key) {
      // Flip the sub-user's permission ON
      const { data: target } = await admin
        .from('terminal_users')
        .select('permissions')
        .eq('id', req.target_user_id)
        .single();
      const current = normalizePermissions(target?.permissions);
      current[req.permission_key as keyof typeof current] = true;
      const { error: updErr } = await admin
        .from('terminal_users')
        .update({ permissions: current })
        .eq('id', req.target_user_id);
      if (updErr) {
        console.error('[admin/team-requests approve permission] failed:', updErr);
        return NextResponse.json(
          { error: 'Failed to apply permission.' },
          { status: 500 },
        );
      }
    }
  }

  const { error: reqUpdErr } = await admin
    .from('terminal_team_requests')
    .update({
      status: nextStatus,
      reviewed_by: authResult.user.userId,
      reviewed_at: new Date().toISOString(),
      admin_notes: adminNotes,
    })
    .eq('id', id);

  if (reqUpdErr) {
    console.error('[admin/team-requests PATCH] status update failed:', reqUpdErr);
    return NextResponse.json(
      { error: 'Failed to record the decision.' },
      { status: 500 },
    );
  }

  // In-app notification to the requesting investor
  const title =
    req.request_type === 'invite_limit'
      ? decision === 'approve'
        ? 'Your invite limit has been raised'
        : 'Your invite limit request was declined'
      : decision === 'approve'
        ? 'Team member permission approved'
        : 'Team member permission request declined';

  await admin.from('terminal_notifications').insert({
    user_id: req.investor_id,
    type: 'team_request_decision',
    title,
    description: adminNotes ?? '',
  });

  return NextResponse.json({ success: true, status: nextStatus });
}
