import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminAuth } from '@/lib/auth/requireAdmin';

// POST /api/dataroom/reorder
// Set the display/sort order for a batch of siblings in one request.
// Body:
//   { type: 'folder', ordered_ids: string[] }
//     → sets display_order = index for each folder id (sibling set inferred from rows)
//   { type: 'document', folder_id: string, ordered_ids: string[] }
//     → sets sort_order = index for each document id within folder_id
//
// The client sends the full desired order for a sibling set after a drag
// completes. We trust the IDs belong to one sibling set but verify on the
// server before writing.
export async function POST(request: NextRequest) {
  const auth = await getAdminAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.ordered_ids) || body.ordered_ids.length === 0) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const orderedIds: string[] = body.ordered_ids;
  if (!orderedIds.every((x) => typeof x === 'string')) {
    return NextResponse.json({ error: 'ordered_ids must be strings' }, { status: 400 });
  }

  const supabase = await createClient();

  if (body.type === 'folder') {
    // Verify all ids share (deal_id, parent_id) — one sibling set.
    const { data: rows } = await supabase
      .from('terminal_dd_folders')
      .select('id, deal_id, parent_id')
      .in('id', orderedIds);

    if (!rows || rows.length !== orderedIds.length) {
      return NextResponse.json({ error: 'Folder ids not found' }, { status: 400 });
    }

    const first = rows[0];
    const sameSibling = rows.every(
      (r) => r.deal_id === first.deal_id && (r.parent_id ?? null) === (first.parent_id ?? null),
    );
    if (!sameSibling) {
      return NextResponse.json({ error: 'Ids span multiple sibling sets' }, { status: 400 });
    }

    // Write sequentially. Parallel updates on the same sibling set may race
    // but all writes are independent rows, so Promise.all is safe.
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('terminal_dd_folders').update({ display_order: i }).eq('id', id),
      ),
    );

    return NextResponse.json({ success: true });
  }

  if (body.type === 'document') {
    if (typeof body.folder_id !== 'string') {
      return NextResponse.json({ error: 'folder_id required for document reorder' }, { status: 400 });
    }

    const { data: rows } = await supabase
      .from('terminal_dd_documents')
      .select('id, folder_id')
      .in('id', orderedIds);

    if (!rows || rows.length !== orderedIds.length) {
      return NextResponse.json({ error: 'Document ids not found' }, { status: 400 });
    }
    if (!rows.every((r) => r.folder_id === body.folder_id)) {
      return NextResponse.json({ error: 'All docs must be in the target folder' }, { status: 400 });
    }

    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('terminal_dd_documents').update({ sort_order: i }).eq('id', id),
      ),
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
