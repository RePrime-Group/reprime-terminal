import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
    .select('id, email, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (profile.id === id) {
    return NextResponse.json({ error: 'Cannot delete your own account.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password) {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
  }

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: pwError } = await verifier.auth.signInWithPassword({
    email: profile.email,
    password,
  });
  if (pwError) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: target, error: targetErr } = await admin
    .from('terminal_users')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (targetErr) {
    console.error('[admin/users/delete] lookup failed:', targetErr);
    return NextResponse.json({ error: 'Failed to look up user.' }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  // Handle rows with NOT NULL FK to terminal_users: delete them.
  const deleteByUser: { table: string; column: string }[] = [
    { table: 'terminal_deal_commitments', column: 'user_id' },
    { table: 'terminal_deal_messages', column: 'user_id' },
    { table: 'terminal_deal_subscriptions', column: 'user_id' },
    { table: 'terminal_nda_signatures', column: 'user_id' },
    { table: 'terminal_notifications', column: 'user_id' },
    { table: 'terminal_watchlist', column: 'user_id' },
    { table: 'terminal_meetings', column: 'investor_id' },
    { table: 'terminal_team_requests', column: 'investor_id' },
  ];

  for (const { table, column } of deleteByUser) {
    const { error } = await admin.from(table).delete().eq(column, id);
    if (error) {
      console.error(`[admin/users/delete] cleanup ${table}.${column} failed:`, error);
      return NextResponse.json({ error: 'Failed to remove related records.' }, { status: 500 });
    }
  }

  // Handle rows with nullable FK: null out the reference so the row survives.
  const nullByUser: { table: string; column: string }[] = [
    { table: 'terminal_activity_log', column: 'user_id' },
    { table: 'terminal_dd_documents', column: 'uploaded_by' },
    { table: 'terminal_deal_tasks', column: 'assignee_id' },
    { table: 'terminal_deal_tasks', column: 'completed_by' },
    { table: 'terminal_deals', column: 'created_by' },
    { table: 'terminal_deals', column: 'assigned_to' },
    { table: 'terminal_invite_tokens', column: 'invited_by' },
    { table: 'terminal_invite_tokens', column: 'parent_investor_id' },
    { table: 'terminal_membership_applications', column: 'reviewed_by' },
    { table: 'terminal_task_attachments', column: 'uploaded_by' },
    { table: 'terminal_team_requests', column: 'target_user_id' },
    { table: 'terminal_team_requests', column: 'reviewed_by' },
    { table: 'terminal_users', column: 'parent_investor_id' },
  ];

  for (const { table, column } of nullByUser) {
    const { error } = await admin.from(table).update({ [column]: null }).eq(column, id);
    if (error) {
      console.error(`[admin/users/delete] null ${table}.${column} failed:`, error);
      return NextResponse.json({ error: 'Failed to clear related references.' }, { status: 500 });
    }
  }

  const { error: userDelErr } = await admin.from('terminal_users').delete().eq('id', id);
  if (userDelErr) {
    console.error('[admin/users/delete] terminal_users delete failed:', userDelErr);
    return NextResponse.json({ error: 'Failed to delete user profile.' }, { status: 500 });
  }

  const { error: authDelErr } = await admin.auth.admin.deleteUser(id);
  if (authDelErr) {
    console.error('[admin/users/delete] auth delete failed:', authDelErr);
    return NextResponse.json({ error: 'Failed to delete auth account.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
