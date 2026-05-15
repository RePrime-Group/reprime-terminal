import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminAuth } from '@/lib/auth/requireAdmin';

// POST /api/dataroom/folders/bulk
// Resolve (or create) a list of folder paths in one call. Used by the master
// ZIP upload flow which can produce hundreds of folder paths and doesn't want
// a request roundtrip per folder.
//
// Body: { deal_id: string, paths: string[] }
//   paths uses forward slashes, e.g. "Leases/Five Star Grocery/Lease".
//
// Behaviour: parents are resolved before children (we sort by path depth).
// At each level we case-insensitively match the segment name against existing
// sibling folders — exact match reuses, no match creates. The full path → id
// map is returned so the client can drop files into the right folder ids.
export async function POST(request: NextRequest) {
  const auth = await getAdminAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.deal_id !== 'string' ||
    !Array.isArray(body.paths)
  ) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const dealId = body.deal_id as string;
  const rawPaths = body.paths as unknown[];

  // Normalize: filter junk, drop empty, dedupe.
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const p of rawPaths) {
    if (typeof p !== 'string') continue;
    const norm = p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
    if (!norm) continue;
    if (norm.split('/').some((seg) => seg === '..' || seg === '.')) continue;
    if (!seen.has(norm)) {
      seen.add(norm);
      paths.push(norm);
    }
  }

  // Expand intermediate paths so "Leases/Five Star/Lease" implies "Leases" and
  // "Leases/Five Star" also exist. Then sort by depth so parents are created
  // before children.
  const expanded = new Set<string>();
  for (const path of paths) {
    const segs = path.split('/');
    for (let i = 1; i <= segs.length; i++) {
      expanded.add(segs.slice(0, i).join('/'));
    }
  }
  const allPaths = [...expanded].sort((a, b) => a.split('/').length - b.split('/').length);

  const supabase = await createClient();

  // Load all existing folders for this deal once — we'll match against this
  // in-memory rather than running a query per path.
  const { data: existingFolders, error: loadErr } = await supabase
    .from('terminal_dd_folders')
    .select('id, name, parent_id, display_order')
    .eq('deal_id', dealId);
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });

  // (parent_id|null, lowercased name) → folder row.
  type FolderRow = { id: string; name: string; parent_id: string | null; display_order: number };
  const folderIndex = new Map<string, FolderRow>();
  const folderKey = (parentId: string | null, name: string) => `${parentId ?? 'root'}::${name.toLowerCase()}`;
  for (const f of (existingFolders ?? []) as FolderRow[]) {
    folderIndex.set(folderKey(f.parent_id, f.name), f);
  }

  // Next display_order per parent — recompute as we add.
  const nextOrderByParent = new Map<string | null, number>();
  for (const f of (existingFolders ?? []) as FolderRow[]) {
    const k = f.parent_id;
    const cur = nextOrderByParent.get(k) ?? -1;
    if (f.display_order > cur) nextOrderByParent.set(k, f.display_order);
  }

  const pathToId = new Map<string, string>();

  for (const path of allPaths) {
    const segs = path.split('/');
    let parentId: string | null = null;
    let currentPath = '';
    for (const seg of segs) {
      currentPath = currentPath ? `${currentPath}/${seg}` : seg;

      // Reuse already-resolved.
      const cached = pathToId.get(currentPath);
      if (cached) {
        parentId = cached;
        continue;
      }

      const key = folderKey(parentId, seg);
      const existing = folderIndex.get(key);
      if (existing) {
        pathToId.set(currentPath, existing.id);
        parentId = existing.id;
        continue;
      }

      // Create. Explicit type on nextOrder breaks an inference cycle between
      // the supabase insert body and the destructured `created` result.
      const nextOrder: number = (nextOrderByParent.get(parentId) ?? -1) + 1;
      const insertRes = await supabase
        .from('terminal_dd_folders')
        .insert({
          deal_id: dealId,
          name: seg,
          icon: null,
          parent_id: parentId,
          display_order: nextOrder,
        })
        .select('id, name, parent_id, display_order')
        .single();
      const created = insertRes.data as FolderRow | null;
      const createErr = insertRes.error;
      if (createErr || !created) {
        return NextResponse.json(
          { error: `Failed to create folder "${currentPath}": ${createErr?.message ?? 'unknown'}` },
          { status: 500 },
        );
      }
      folderIndex.set(key, created);
      nextOrderByParent.set(parentId, nextOrder);
      pathToId.set(currentPath, created.id);
      parentId = created.id;
    }
  }

  return NextResponse.json({ pathToId: Object.fromEntries(pathToId) });
}
