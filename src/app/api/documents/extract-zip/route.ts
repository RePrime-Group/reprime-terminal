import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import JSZip from 'jszip';

const MAX_ZIP_EXTRACT_SIZE = 200 * 1024 * 1024; // 200MB

interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
}

export async function POST(request: NextRequest) {
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
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['owner', 'employee'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { dealId, storagePath, targetFolderId } = body;

  if (!dealId || !storagePath) {
    return NextResponse.json({ error: 'dealId and storagePath are required' }, { status: 400 });
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('terminal-dd-documents')
    .download(storagePath);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: `Failed to download ZIP: ${downloadError?.message}` }, { status: 500 });
  }

  if (fileData.size > MAX_ZIP_EXTRACT_SIZE) {
    return NextResponse.json(
      { error: `ZIP exceeds ${MAX_ZIP_EXTRACT_SIZE / 1024 / 1024}MB extraction limit` },
      { status: 400 },
    );
  }

  const errors: string[] = [];
  let foldersCreated = 0;
  let filesExtracted = 0;

  try {
    const zip = await JSZip.loadAsync(await fileData.arrayBuffer());
    const junkPatterns = ['__MACOSX', '.DS_Store', 'Thumbs.db', '._.'];

    // Pull every folder in the deal up-front so we can match existing paths
    // and avoid duplicate creation when a ZIP is re-imported.
    const { data: existingFolders } = await supabase
      .from('terminal_dd_folders')
      .select('id, name, parent_id, display_order')
      .eq('deal_id', dealId);

    const allFolders: FolderRow[] = (existingFolders ?? []) as FolderRow[];
    const childrenByParent = new Map<string | null, FolderRow[]>();
    for (const f of allFolders) {
      const key = f.parent_id ?? null;
      const list = childrenByParent.get(key) ?? [];
      list.push(f);
      childrenByParent.set(key, list);
    }

    // Cache: normalized path segments joined by "/" → folder id.
    // "" → targetFolderId (or null for root).
    const pathCache = new Map<string, string | null>();
    pathCache.set('', targetFolderId ?? null);

    // Resolve a folder path like "Leases/Tractor Supply", creating folders as
    // needed. Returns the deepest folder id. Case-insensitive matching against
    // existing folders under the same parent.
    async function resolvePath(pathParts: string[]): Promise<string | null> {
      const key = pathParts.join('/').toLowerCase();
      if (pathCache.has(key)) return pathCache.get(key)!;

      let parentId: string | null = targetFolderId ?? null;
      for (let i = 0; i < pathParts.length; i++) {
        const segment = pathParts[i];
        const segKey = pathParts.slice(0, i + 1).join('/').toLowerCase();

        const cached = pathCache.get(segKey);
        if (cached !== undefined) {
          parentId = cached;
          continue;
        }

        // Look for an existing child folder under parentId with matching name.
        const siblings = childrenByParent.get(parentId) ?? [];
        const match = siblings.find((f) => f.name.toLowerCase() === segment.toLowerCase());

        if (match) {
          parentId = match.id;
          pathCache.set(segKey, match.id);
          continue;
        }

        // Create it. display_order = max(siblings) + 1.
        const nextOrder = siblings.reduce(
          (max, s) => (s.display_order > max ? s.display_order : max),
          -1,
        ) + 1;

        const { data: newFolder, error: folderError } = await supabase
          .from('terminal_dd_folders')
          .insert({
            deal_id: dealId,
            name: segment,
            icon: '📁',
            parent_id: parentId,
            display_order: nextOrder,
          })
          .select('id, name, parent_id, display_order')
          .single();

        if (folderError || !newFolder) {
          errors.push(`Failed to create folder "${segment}": ${folderError?.message}`);
          return null;
        }

        const row = newFolder as FolderRow;
        // Update local indexes so subsequent files in this ZIP see it.
        allFolders.push(row);
        const list = childrenByParent.get(parentId) ?? [];
        list.push(row);
        childrenByParent.set(parentId, list);
        pathCache.set(segKey, row.id);
        foldersCreated++;
        parentId = row.id;
      }
      pathCache.set(key, parentId);
      return parentId;
    }

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (junkPatterns.some((p) => relativePath.includes(p))) continue;
      if (zipEntry.dir) continue;

      const parts = relativePath.split('/').filter(Boolean);
      if (parts.length === 0) continue;

      const fileName = parts[parts.length - 1];
      const folderParts = parts.slice(0, -1); // every segment except the file itself

      // If ZIP has no folders (files dumped at root) and no targetFolderId,
      // put them into an "Extracted" folder.
      let folderId: string | null;
      if (folderParts.length === 0 && !targetFolderId) {
        folderId = await resolvePath(['Extracted']);
      } else {
        folderId = await resolvePath(folderParts);
      }

      if (!folderId) {
        errors.push(`${fileName}: could not resolve target folder`);
        continue;
      }

      try {
        const content = await zipEntry.async('arraybuffer');
        const uploadPath = `${dealId}/${folderId}/${Date.now()}-${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('terminal-dd-documents')
          .upload(uploadPath, new Blob([content]), {
            contentType: guessMimeType(fileName),
          });

        if (uploadError) {
          errors.push(`${fileName}: upload failed — ${uploadError.message}`);
          continue;
        }

        const { error: insertError } = await supabase
          .from('terminal_dd_documents')
          .insert({
            folder_id: folderId,
            deal_id: dealId,
            name: fileName,
            display_name: fileName,
            file_size: String(content.byteLength),
            file_type: guessMimeType(fileName),
            storage_path: uploadPath,
            uploaded_by: user.id,
          });

        if (insertError) {
          errors.push(`${fileName}: saved but record creation failed — ${insertError.message}`);
          continue;
        }

        filesExtracted++;
      } catch {
        errors.push(`${fileName}: extraction failed`);
      }
    }
  } catch {
    return NextResponse.json({ error: 'Failed to read ZIP file. It may be corrupted.' }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    foldersCreated,
    filesExtracted,
    errors,
  });
}

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    csv: 'text/csv',
    txt: 'text/plain',
  };
  return mimeMap[ext ?? ''] ?? 'application/octet-stream';
}
