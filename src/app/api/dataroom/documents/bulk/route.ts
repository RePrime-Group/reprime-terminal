import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminAuth } from '@/lib/auth/requireAdmin';

// POST /api/dataroom/documents/bulk
// Body:
//   { action: 'move', document_ids: string[], target_folder_id: string }
//   { action: 'delete', document_ids: string[] }
export async function POST(request: NextRequest) {
  const auth = await getAdminAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.document_ids) || body.document_ids.length === 0) {
    return NextResponse.json({ error: 'document_ids required' }, { status: 400 });
  }

  const ids: string[] = body.document_ids;
  const supabase = await createClient();

  if (body.action === 'move') {
    if (typeof body.target_folder_id !== 'string') {
      return NextResponse.json({ error: 'target_folder_id required' }, { status: 400 });
    }

    // Verify all docs are in one deal and the target folder is in that deal.
    const { data: docs } = await supabase
      .from('terminal_dd_documents')
      .select('id, deal_id')
      .in('id', ids);

    if (!docs || docs.length !== ids.length) {
      return NextResponse.json({ error: 'Some documents not found' }, { status: 404 });
    }

    const dealId = docs[0].deal_id;
    if (!docs.every((d) => d.deal_id === dealId)) {
      return NextResponse.json({ error: 'Documents span multiple deals' }, { status: 400 });
    }

    const { data: target } = await supabase
      .from('terminal_dd_folders')
      .select('id, deal_id')
      .eq('id', body.target_folder_id)
      .single();
    if (!target || target.deal_id !== dealId) {
      return NextResponse.json({ error: 'Invalid target folder' }, { status: 400 });
    }

    // Append all to end. Compute starting sort_order from current max in target.
    const { data: existing } = await supabase
      .from('terminal_dd_documents')
      .select('sort_order')
      .eq('folder_id', body.target_folder_id);
    const startOrder = (existing ?? []).reduce(
      (max, s) => (s.sort_order > max ? s.sort_order : max),
      -1,
    ) + 1;

    await Promise.all(
      ids.map((docId, i) =>
        supabase
          .from('terminal_dd_documents')
          .update({ folder_id: body.target_folder_id, sort_order: startOrder + i })
          .eq('id', docId),
      ),
    );

    return NextResponse.json({ success: true, moved: ids.length });
  }

  if (body.action === 'delete') {
    const admin = createAdminClient();
    const { data: docs } = await admin
      .from('terminal_dd_documents')
      .select('id, storage_path')
      .in('id', ids);

    const paths = (docs ?? []).map((d) => d.storage_path).filter((p): p is string => !!p);
    if (paths.length > 0) {
      for (let i = 0; i < paths.length; i += 100) {
        await admin.storage.from('terminal-dd-documents').remove(paths.slice(i, i + 100));
      }
    }

    const { error } = await admin.from('terminal_dd_documents').delete().in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, deleted: ids.length });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
