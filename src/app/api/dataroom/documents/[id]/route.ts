import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminAuth } from '@/lib/auth/requireAdmin';

// PATCH /api/dataroom/documents/[id]
// Rename (display_name), move (folder_id), toggle is_downloadable, or set doc_status.
// Body: { display_name?, folder_id?, is_downloadable?, doc_status? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAdminAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('terminal_dd_documents')
    .select('id, deal_id, folder_id')
    .eq('id', id)
    .single();

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  const update: Record<string, unknown> = {};

  if (typeof body.display_name === 'string') {
    const trimmed = body.display_name.trim();
    if (!trimmed) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    update.display_name = trimmed;
  }

  if (typeof body.folder_id === 'string' && body.folder_id !== doc.folder_id) {
    // Verify target folder belongs to same deal.
    const { data: target } = await supabase
      .from('terminal_dd_folders')
      .select('id, deal_id')
      .eq('id', body.folder_id)
      .single();
    if (!target || target.deal_id !== doc.deal_id) {
      return NextResponse.json({ error: 'Invalid target folder' }, { status: 400 });
    }
    update.folder_id = body.folder_id;

    // Append to end of target folder.
    const { data: siblings } = await supabase
      .from('terminal_dd_documents')
      .select('sort_order')
      .eq('folder_id', body.folder_id);
    update.sort_order = (siblings ?? []).reduce(
      (max, s) => (s.sort_order > max ? s.sort_order : max),
      -1,
    ) + 1;
  }

  if (typeof body.is_downloadable === 'boolean') {
    update.is_downloadable = body.is_downloadable;
  }

  if (typeof body.doc_status === 'string') {
    update.doc_status = body.doc_status;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('terminal_dd_documents')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}

// DELETE /api/dataroom/documents/[id]
// Remove the document record and its storage object.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAdminAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from('terminal_dd_documents')
    .select('id, storage_path')
    .eq('id', id)
    .single();

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  if (doc.storage_path) {
    await admin.storage.from('terminal-dd-documents').remove([doc.storage_path]);
  }

  const { error } = await admin.from('terminal_dd_documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
