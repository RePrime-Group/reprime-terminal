import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import JSZip from 'jszip';
import { classifyDocuments, DD_CATEGORIES } from '@/lib/ai/classify-documents';

export const maxDuration = 60; // Allow up to 60s for AI classification

const MAX_ZIP_SIZE = 500 * 1024 * 1024; // 500MB

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify admin
  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['owner', 'employee'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { dealId, storagePath, addressLabel } = body;

  if (!dealId || !storagePath) {
    return NextResponse.json({ error: 'dealId and storagePath required' }, { status: 400 });
  }

  // Download ZIP from storage
  const { data: fileData, error: dlError } = await supabase.storage
    .from('terminal-dd-documents')
    .download(storagePath);

  if (dlError || !fileData) {
    return NextResponse.json({ error: `Download failed: ${dlError?.message}` }, { status: 500 });
  }

  if (fileData.size > MAX_ZIP_SIZE) {
    return NextResponse.json({ error: 'ZIP exceeds 500MB limit' }, { status: 400 });
  }

  const junkPatterns = ['__MACOSX', '.DS_Store', 'Thumbs.db', '._.', 'desktop.ini'];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await fileData.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'Invalid ZIP file' }, { status: 400 });
  }

  // Collect all file paths (excluding junk)
  const filePaths: string[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    if (junkPatterns.some((j) => path.includes(j))) continue;
    filePaths.push(path);
  }

  if (filePaths.length === 0) {
    return NextResponse.json({ error: 'ZIP contains no valid files' }, { status: 400 });
  }

  // AI Classification
  const classifications = await classifyDocuments(filePaths);

  // Group by category
  const grouped = new Map<string, typeof classifications>();
  for (const cls of classifications) {
    const existing = grouped.get(cls.category) ?? [];
    existing.push(cls);
    grouped.set(cls.category, existing);
  }

  // Get existing folders
  const { data: existingFolders } = await supabase
    .from('terminal_dd_folders')
    .select('id, name, display_order')
    .eq('deal_id', dealId)
    .order('display_order', { ascending: true });

  const folderMap = new Map<string, string>(); // categoryId -> folderId
  let maxOrder = existingFolders?.reduce((max, f) => Math.max(max, f.display_order), 0) ?? 0;

  // Normalize folder name: "01_Marketing" → "marketing"
  function norm(n: string) { return n.toLowerCase().replace(/^\d+_/, '').replace(/_/g, ' ').trim(); }

  // Map AI category IDs to existing folders by normalized name matching
  existingFolders?.forEach((f) => {
    const normalized = norm(f.name);
    for (const cat of DD_CATEGORIES) {
      const catNorm = cat.name.toLowerCase().replace(/[\/&]/g, ' ').replace(/\s+/g, ' ').trim();
      if (normalized.includes(catNorm) || catNorm.includes(normalized) ||
          normalized.replace(/\s/g, '') === catNorm.replace(/\s/g, '')) {
        folderMap.set(cat.id, f.id);
      }
    }
    // Also map by direct ID match for common patterns
    if (normalized.includes('marketing')) folderMap.set('marketing', f.id);
    if (normalized.includes('market') && normalized.includes('research')) folderMap.set('market_research', f.id);
    if (normalized.includes('legal')) folderMap.set('legal', f.id);
    if (normalized.includes('financial')) folderMap.set('financials', f.id);
    if (normalized.includes('lease')) folderMap.set('leases', f.id);
    if (normalized.includes('dd') && normalized.includes('report')) folderMap.set('dd_reports', f.id);
    if (normalized.includes('financing') || normalized.includes('lender')) folderMap.set('financing', f.id);
    if (normalized.includes('insurance')) folderMap.set('insurance', f.id);
    if (normalized.includes('presentation')) folderMap.set('presentations', f.id);
    if (normalized.includes('site') && normalized.includes('visit')) folderMap.set('site_visit', f.id);
    if (normalized.includes('investor')) folderMap.set('investor_materials', f.id);
    if (normalized.includes('post') && normalized.includes('closing')) folderMap.set('post_closing', f.id);
  });

  let foldersCreated = 0;
  let filesUploaded = 0;
  const errors: string[] = [];

  // Create folders and upload files
  for (const [categoryId, files] of grouped) {
    const cat = DD_CATEGORIES.find((c) => c.id === categoryId) ?? DD_CATEGORIES[DD_CATEGORIES.length - 1];

    // Get or create folder
    let folderId = folderMap.get(categoryId);
    if (!folderId) {
      maxOrder++;
      const folderName = addressLabel ? `${cat.name} — ${addressLabel}` : cat.name;
      const { data: newFolder, error: folderErr } = await supabase
        .from('terminal_dd_folders')
        .insert({
          deal_id: dealId,
          name: folderName,
          icon: cat.icon,
          display_order: maxOrder,
        })
        .select('id')
        .single();

      if (folderErr || !newFolder) {
        errors.push(`Failed to create folder "${cat.name}": ${folderErr?.message}`);
        continue;
      }
      folderId = newFolder.id as string;
      folderMap.set(categoryId, folderId);
      foldersCreated++;
    }

    // Upload each file
    for (const file of files) {
      try {
        const zipEntry = zip.files[file.originalPath];
        if (!zipEntry) continue;

        const content = await zipEntry.async('arraybuffer');
        const uploadPath = `${dealId}/${folderId}/${Date.now()}-${file.fileName}`;

        const ext = file.fileName.split('.').pop()?.toLowerCase() ?? '';
        const mimeMap: Record<string, string> = {
          pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        };
        const mimeType = mimeMap[ext] ?? 'application/octet-stream';

        const { error: uploadErr } = await supabase.storage
          .from('terminal-dd-documents')
          .upload(uploadPath, new Blob([content]), { contentType: mimeType });

        if (uploadErr) {
          errors.push(`${file.fileName}: upload failed — ${uploadErr.message}`);
          continue;
        }

        const { error: insertErr } = await supabase
          .from('terminal_dd_documents')
          .insert({
            folder_id: folderId,
            deal_id: dealId,
            name: file.fileName,
            file_size: String(content.byteLength),
            file_type: mimeType,
            storage_path: uploadPath,
            is_verified: false,
            uploaded_by: user.id,
          });

        if (insertErr) {
          errors.push(`${file.fileName}: record failed — ${insertErr.message}`);
          continue;
        }

        filesUploaded++;
      } catch (err) {
        errors.push(`${file.fileName}: extraction error`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    foldersCreated,
    filesUploaded,
    totalFiles: filePaths.length,
    classifications: classifications.map((c) => ({
      fileName: c.fileName,
      category: c.categoryName,
      confidence: c.confidence,
    })),
    errors,
  });
}
