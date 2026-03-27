import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendInviteEmail, sendApplicationRejectionEmail } from '@/lib/email/send';

async function getAdminSupabase() {
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
  if (!user) return { error: 'Unauthorized' as const, status: 401 };

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['owner', 'employee'].includes(profile.role)) {
    return { error: 'Forbidden' as const, status: 403 };
  }

  return { supabase, user };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAdminSupabase();
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { data, error } = await result.supabase
    .from('terminal_membership_applications')
    .select('id, full_name, email, company_name, phone, status, admin_notes, reviewed_by, reviewed_at, created_at')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAdminSupabase();
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { supabase, user } = result;

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.status && ['pending', 'approved', 'rejected'].includes(body.status)) {
    updates.status = body.status;
  }
  if (typeof body.admin_notes === 'string') {
    updates.admin_notes = body.admin_notes || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Track who reviewed and when
  updates.reviewed_by = user.id;
  updates.reviewed_at = new Date().toISOString();

  // Fetch the application to get email/name for notifications
  const { data: application } = await supabase
    .from('terminal_membership_applications')
    .select('email, full_name, status')
    .eq('id', id)
    .single();

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('terminal_membership_applications')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('[applications] Update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const newStatus = updates.status as string | undefined;
  const origin = request.headers.get('origin') || 'https://reprimeterminal.com';

  // On approval: create invite token + send invite email
  if (newStatus === 'approved' && application.status !== 'approved') {
    try {
      const { data: token } = await supabase
        .from('terminal_invite_tokens')
        .insert({ email: application.email, role: 'investor', invited_by: user.id })
        .select('token, expires_at')
        .single();

      if (token) {
        const inviteUrl = `${origin}/en/invite/${token.token}`;
        await sendInviteEmail(application.email, inviteUrl, token.token, token.expires_at);
      }
    } catch (err) {
      console.error('[applications] Failed to create invite on approval:', err);
    }
  }

  // On rejection: send rejection email
  if (newStatus === 'rejected' && application.status !== 'rejected') {
    try {
      await sendApplicationRejectionEmail(application.email, application.full_name);
    } catch (err) {
      console.error('[applications] Failed to send rejection email:', err);
    }
  }

  return NextResponse.json({ success: true });
}
