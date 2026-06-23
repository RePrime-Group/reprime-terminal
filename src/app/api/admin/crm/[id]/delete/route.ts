import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CrmAttachment, CrmDocument } from '@/lib/types/database';

/**
 * Hard-delete an investor from the CRM.
 *
 * - Owner-only (matches /api/admin/users/[id]/delete).
 * - Re-verifies the caller's password via an ephemeral Supabase client (does
 *   NOT touch the active session) before doing anything destructive.
 * - Cascades to terminal_crm_messages, terminal_crm_mandates,
 *   terminal_crm_form_sends via ON DELETE CASCADE.
 * - Best-effort wipes storage objects in the two CRM buckets
 *   (terminal-investor-photos, terminal-investor-files). Other buckets are
 *   untouched.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── Caller auth ────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  // ── Password re-verification ──────────────────────────────────────────────
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password) {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
  }

  // Ephemeral client — does NOT persist the session, so re-verifying the
  // password doesn't touch the caller's logged-in cookie.
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

  // ── Gather storage paths before deleting ──────────────────────────────────
  const admin = createAdminClient();

  const { data: investor, error: invErr } = await admin
    .from('terminal_crm_investors')
    .select('id, photo_url, documents')
    .eq('id', id)
    .maybeSingle();
  if (invErr) {
    console.error('[admin/crm/delete] investor lookup failed:', invErr);
    return NextResponse.json({ error: 'Failed to look up investor.' }, { status: 500 });
  }
  if (!investor) {
    return NextResponse.json({ error: 'Investor not found.' }, { status: 404 });
  }

  const { data: msgs } = await admin
    .from('terminal_crm_messages')
    .select('attachments')
    .eq('investor_id', id);

  const filePaths: string[] = [];

  // Document attachments: uploadCrmFile stores private-bucket files with
  // `url = storage path`. Skip anything that already looks like an http URL.
  for (const doc of (investor.documents as CrmDocument[] | null) ?? []) {
    if (doc?.url && !/^https?:\/\//i.test(doc.url)) filePaths.push(doc.url);
  }
  for (const m of msgs ?? []) {
    for (const att of (m.attachments as CrmAttachment[] | null) ?? []) {
      if (att?.url && !/^https?:\/\//i.test(att.url)) filePaths.push(att.url);
    }
  }

  const photoPaths: string[] = [];
  if (investor.photo_url) {
    const marker = '/terminal-investor-photos/';
    const idx = investor.photo_url.indexOf(marker);
    if (idx >= 0) {
      photoPaths.push(investor.photo_url.slice(idx + marker.length).split('?')[0]);
    }
  }

  // ── Delete the row (cascades to messages, mandates, form_sends) ───────────
  const { error: delErr } = await admin
    .from('terminal_crm_investors')
    .delete()
    .eq('id', id);
  if (delErr) {
    console.error('[admin/crm/delete] row delete failed:', delErr);
    return NextResponse.json({ error: 'Failed to delete investor.' }, { status: 500 });
  }

  // ── Best-effort storage cleanup ───────────────────────────────────────────
  // Failures here leave orphan files, which is acceptable — the row is gone
  // so the UI no longer references them.
  if (filePaths.length > 0) {
    const { error } = await admin.storage.from('terminal-investor-files').remove(filePaths);
    if (error) console.warn('[admin/crm/delete] file cleanup failed:', error);
  }
  if (photoPaths.length > 0) {
    const { error } = await admin.storage.from('terminal-investor-photos').remove(photoPaths);
    if (error) console.warn('[admin/crm/delete] photo cleanup failed:', error);
  }

  return NextResponse.json({ success: true });
}
