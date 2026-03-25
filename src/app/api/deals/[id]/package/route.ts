import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import JSZip from 'jszip';

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

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch deal name
  const { data: deal, error: dealError } = await supabase
    .from('terminal_deals')
    .select('name')
    .eq('id', id)
    .single();

  if (!deal || dealError) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Fetch ALL documents with files for this deal
  const { data: docs } = await supabase
    .from('terminal_dd_documents')
    .select('id, name, storage_path, file_type, is_verified, folder_id')
    .eq('deal_id', id)
    .not('storage_path', 'is', null);

  if (!docs || docs.length === 0) {
    return NextResponse.json({ error: 'No files found' }, { status: 404 });
  }

  // Fetch all folder names for the documents that have a folder_id
  const folderIds = [...new Set(docs.filter((d) => d.folder_id).map((d) => d.folder_id))];
  const folderMap: Record<string, string> = {};

  if (folderIds.length > 0) {
    const { data: folders } = await supabase
      .from('terminal_dd_folders')
      .select('id, name')
      .in('id', folderIds);

    if (folders) {
      for (const folder of folders) {
        folderMap[folder.id] = folder.name;
      }
    }
  }

  // Build ZIP
  const zip = new JSZip();

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
      const folderName = doc.folder_id && folderMap[doc.folder_id]
        ? folderMap[doc.folder_id]
        : 'Uncategorized';
      const filePath = `${folderName}/${doc.name}`;

      zip.file(filePath, buffer);
    } catch (err) {
      console.error(`Error processing file ${doc.name}:`, err);
      continue;
    }
  }

  const zipData = await zip.generateAsync({ type: 'arraybuffer' });

  // Log activity
  try {
    await supabase.from('terminal_activity_log').insert({
      user_id: user.id,
      deal_id: id,
      action: 'document_downloaded',
      metadata: { type: 'complete_package' },
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }

  const safeDealName = deal.name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();

  return new NextResponse(zipData, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeDealName} - Due Diligence Package.zip"`,
    },
  });
}
