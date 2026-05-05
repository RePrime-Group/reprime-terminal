// DEPRECATED: replaced by client-side ZIP assembly in DataRoomTab. Kept as a
// safety fallback while the new flow bakes in production. Hits Vercel's
// 100 MB response cap, 1 GB memory cap, and execution timeout for any
// non-trivial deal — do not link to it from the UI.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import JSZip from 'jszip';
import { buildFolderPath, sanitizePathSegment, type FolderRow } from '@/lib/utils/dataRoomPaths';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { data: deal, error: dealError } = await supabase
    .from('terminal_deals')
    .select('name')
    .eq('id', id)
    .single();

  if (!deal || dealError) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Optional ?docs=id1,id2,id3 filter for "Download Selected". When absent,
  // every document in the deal is included ("Download All").
  const docsParam = request.nextUrl.searchParams.get('docs');
  const selectedIds = docsParam
    ? docsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : null;

  let query = supabase
    .from('terminal_dd_documents')
    .select('id, name, display_name, storage_path, file_type, folder_id')
    .eq('deal_id', id)
    .not('storage_path', 'is', null);

  if (selectedIds && selectedIds.length > 0) {
    query = query.in('id', selectedIds);
  }

  const { data: docs } = await query;

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No files found' }, { status: 404 });
  }

  // Fetch every folder in the deal so we can build full paths (cheap query
  // even for deals with hundreds of folders).
  const { data: folders } = await supabase
    .from('terminal_dd_folders')
    .select('id, name, parent_id')
    .eq('deal_id', id);

  const folderMap = new Map<string, FolderRow>();
  for (const f of folders ?? []) {
    folderMap.set(f.id, f as FolderRow);
  }

  const zip = new JSZip();
  const usedPaths = new Set<string>(); // de-dupe collisions from same-name files in same folder

  for (const doc of docs) {
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('terminal-dd-documents')
        .download(doc.storage_path);

      if (downloadError || !fileData) {
        console.error(`Failed to download file ${doc.name}: ${downloadError?.message}`);
        continue;
      }

      const buffer = new Uint8Array(await fileData.arrayBuffer());
      const folderPath = doc.folder_id ? buildFolderPath(doc.folder_id, folderMap) : 'Uncategorized';
      const fileName = sanitizePathSegment(doc.display_name ?? doc.name);
      let path = `${folderPath}/${fileName}`;

      // Same-named file in the same folder: append (1), (2), ...
      if (usedPaths.has(path)) {
        const dot = fileName.lastIndexOf('.');
        const base = dot > 0 ? fileName.slice(0, dot) : fileName;
        const ext = dot > 0 ? fileName.slice(dot) : '';
        let n = 1;
        while (usedPaths.has(`${folderPath}/${base} (${n})${ext}`)) n++;
        path = `${folderPath}/${base} (${n})${ext}`;
      }
      usedPaths.add(path);

      zip.file(path, buffer);
    } catch (err) {
      console.error(`Error processing file ${doc.name}:`, err);
      continue;
    }
  }

  const zipData = await zip.generateAsync({ type: 'arraybuffer' });

  try {
    await supabase.from('terminal_activity_log').insert({
      user_id: user.id,
      deal_id: id,
      action: 'document_downloaded',
      metadata: {
        type: selectedIds ? 'selected_package' : 'complete_package',
        count: docs.length,
      },
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }

  const safeDealName = deal.name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
  const suffix = selectedIds ? 'Selected Documents' : 'Due Diligence Package';

  return new NextResponse(zipData, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeDealName} - ${suffix}.zip"`,
    },
  });
}
