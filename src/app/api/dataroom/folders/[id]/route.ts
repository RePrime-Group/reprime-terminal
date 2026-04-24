import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminAuth } from '@/lib/auth/requireAdmin';

// PATCH /api/dataroom/folders/[id]
// Rename, change icon, or move (change parent_id).
// Body: { name?, icon?, parent_id?: string | null }
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

  const { data: folder } = await supabase
    .from('terminal_dd_folders')
    .select('id, deal_id, parent_id')
    .eq('id', id)
    .single();

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

  const update: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    update.name = name;
  }

  if (typeof body.icon === 'string' || body.icon === null) {
    update.icon = body.icon;
  }

  // Move: parent_id can be string (new parent) or null (move to root).
  if ('parent_id' in body) {
    const newParentId: string | null = body.parent_id;

    if (newParentId === id) {
      return NextResponse.json({ error: 'Cannot parent a folder to itself' }, { status: 400 });
    }

    if (newParentId !== null) {
      // Verify target exists, is in same deal, and isn't a descendant (circular check).
      const { data: all } = await supabase
        .from('terminal_dd_folders')
        .select('id, parent_id, deal_id')
        .eq('deal_id', folder.deal_id);

      const byId = new Map((all ?? []).map((f) => [f.id, f]));
      const target = byId.get(newParentId);
      if (!target) {
        return NextResponse.json({ error: 'Invalid target folder' }, { status: 400 });
      }

      // Walk up from target: if we encounter `id`, moving would create a cycle.
      let cursor: string | null = newParentId;
      const seen = new Set<string>();
      while (cursor) {
        if (cursor === id) {
          return NextResponse.json({ error: 'Cannot move folder into its own descendant' }, { status: 400 });
        }
        if (seen.has(cursor)) break; // defensive: corrupt tree
        seen.add(cursor);
        cursor = byId.get(cursor)?.parent_id ?? null;
      }
    }

    update.parent_id = newParentId;

    // Append to end of new parent's children.
    const siblingsQuery = supabase
      .from('terminal_dd_folders')
      .select('display_order')
      .eq('deal_id', folder.deal_id)
      .neq('id', id);
    const { data: siblings } = newParentId
      ? await siblingsQuery.eq('parent_id', newParentId)
      : await siblingsQuery.is('parent_id', null);

    update.display_order = (siblings ?? []).reduce(
      (max, s) => (s.display_order > max ? s.display_order : max),
      -1,
    ) + 1;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('terminal_dd_folders')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ folder: data });
}

// DELETE /api/dataroom/folders/[id]?mode=cascade|reparent
// cascade:  delete folder + every descendant folder + every descendant document (incl. storage objects)
// reparent: move all direct children (folders and docs) to this folder's parent, then delete this folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAdminAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const mode = request.nextUrl.searchParams.get('mode') ?? 'cascade';
  if (mode !== 'cascade' && mode !== 'reparent') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  // Service-role client bypasses RLS for bulk cleanup, matches the pattern in
  // /api/deals/[id]/delete/route.ts.
  const admin = createAdminClient();

  const { data: folder } = await admin
    .from('terminal_dd_folders')
    .select('id, deal_id, parent_id')
    .eq('id', id)
    .single();

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

  // Load every folder in the deal so we can resolve the subtree locally.
  const { data: allFolders } = await admin
    .from('terminal_dd_folders')
    .select('id, parent_id')
    .eq('deal_id', folder.deal_id);

  const childrenByParent = new Map<string | null, string[]>();
  for (const f of allFolders ?? []) {
    const key = f.parent_id ?? null;
    const list = childrenByParent.get(key) ?? [];
    list.push(f.id);
    childrenByParent.set(key, list);
  }

  if (mode === 'reparent') {
    // Move direct subfolder children to the target folder's parent (null if target is root).
    await admin
      .from('terminal_dd_folders')
      .update({ parent_id: folder.parent_id })
      .eq('parent_id', id);

    // Move direct documents to the target folder's parent. If target is root
    // (parent_id is null) there's no folder to move documents into — reparent
    // is only meaningful when a parent exists. Reject at the API level.
    if (folder.parent_id === null) {
      return NextResponse.json(
        { error: 'Cannot reparent contents of a root folder — use cascade or move contents manually first' },
        { status: 400 },
      );
    }

    await admin
      .from('terminal_dd_documents')
      .update({ folder_id: folder.parent_id })
      .eq('folder_id', id);

    const { error } = await admin.from('terminal_dd_folders').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, mode });
  }

  // cascade: collect every descendant folder id (including self).
  const toDelete: string[] = [];
  const stack: string[] = [id];
  while (stack.length > 0) {
    const next = stack.pop()!;
    toDelete.push(next);
    const kids = childrenByParent.get(next) ?? [];
    stack.push(...kids);
  }

  // Remove storage objects for every document inside the subtree.
  const { data: docs } = await admin
    .from('terminal_dd_documents')
    .select('storage_path')
    .in('folder_id', toDelete);

  const paths = (docs ?? []).map((d) => d.storage_path).filter((p): p is string => !!p);
  if (paths.length > 0) {
    for (let i = 0; i < paths.length; i += 100) {
      await admin.storage.from('terminal-dd-documents').remove(paths.slice(i, i + 100));
    }
  }

  // Delete document rows, then folder rows. Single statements with IN(...) let
  // Postgres check the parent_id FK at statement end, avoiding leaf-first
  // ordering issues.
  await admin.from('terminal_dd_documents').delete().in('folder_id', toDelete);

  const { error: folderErr } = await admin
    .from('terminal_dd_folders')
    .delete()
    .in('id', toDelete);

  if (folderErr) return NextResponse.json({ error: folderErr.message }, { status: 500 });
  return NextResponse.json({ success: true, mode, deletedFolders: toDelete.length });
}
