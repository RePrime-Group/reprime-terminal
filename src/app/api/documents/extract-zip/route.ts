import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import JSZip from 'jszip';

const MAX_ZIP_EXTRACT_SIZE = 200 * 1024 * 1024; // 200MB

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

  // Verify auth + admin role
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
  const { dealId, storagePath } = body;

  if (!dealId || !storagePath) {
    return NextResponse.json({ error: 'dealId and storagePath are required' }, { status: 400 });
  }

  // Download ZIP from Supabase storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('terminal-dd-documents')
    .download(storagePath);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: `Failed to download ZIP: ${downloadError?.message}` }, { status: 500 });
  }

  // Check size
  if (fileData.size > MAX_ZIP_EXTRACT_SIZE) {
    return NextResponse.json({ error: `ZIP exceeds ${MAX_ZIP_EXTRACT_SIZE / 1024 / 1024}MB extraction limit` }, { status: 400 });
  }

  const errors: string[] = [];
  let foldersCreated = 0;
  let filesExtracted = 0;

  try {
    const zip = await JSZip.loadAsync(await fileData.arrayBuffer());
    const junkPatterns = ['__MACOSX', '.DS_Store', 'Thumbs.db', '._.'];

    // Get existing folders for this deal
    const { data: existingFolders } = await supabase
      .from('terminal_dd_folders')
      .select('id, name, display_order')
      .eq('deal_id', dealId)
      .order('display_order', { ascending: true });

    const folderMap = new Map<string, string>(); // folderName -> folderId
    let maxOrder = existingFolders?.reduce((max, f) => Math.max(max, f.display_order), 0) ?? 0;

    // Map existing folders
    existingFolders?.forEach((f) => {
      folderMap.set(f.name.toLowerCase(), f.id);
    });

    // Process ZIP entries
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      // Skip junk files
      if (junkPatterns.some((p) => relativePath.includes(p))) continue;
      // Skip directories themselves
      if (zipEntry.dir) continue;

      const parts = relativePath.split('/').filter(Boolean);
      const fileName = parts[parts.length - 1];
      const folderName = parts.length > 1 ? parts[parts.length - 2] : 'Extracted';

      // Get or create folder
      let folderId = folderMap.get(folderName.toLowerCase());
      if (!folderId) {
        maxOrder++;
        const { data: newFolder, error: folderError } = await supabase
          .from('terminal_dd_folders')
          .insert({
            deal_id: dealId,
            name: folderName,
            icon: '📁',
            display_order: maxOrder,
          })
          .select('id')
          .single();

        if (folderError || !newFolder) {
          errors.push(`Failed to create folder "${folderName}": ${folderError?.message}`);
          continue;
        }
        folderId = newFolder.id as string;
        folderMap.set(folderName.toLowerCase(), folderId);
        foldersCreated++;
      }

      // Extract file content
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

        // Create document record
        const { error: insertError } = await supabase
          .from('terminal_dd_documents')
          .insert({
            folder_id: folderId,
            deal_id: dealId,
            name: fileName,
            file_size: String(content.byteLength),
            file_type: guessMimeType(fileName),
            storage_path: uploadPath,
            is_verified: false,
            uploaded_by: user.id,
          });

        if (insertError) {
          errors.push(`${fileName}: saved but record creation failed — ${insertError.message}`);
          continue;
        }

        filesExtracted++;
      } catch (extractErr) {
        errors.push(`${fileName}: extraction failed`);
      }
    }
  } catch (zipErr) {
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
