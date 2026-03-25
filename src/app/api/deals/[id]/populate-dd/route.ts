import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getTemplateForPropertyType, DD_FOLDERS } from '@/lib/dd-templates';

export async function POST(
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
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get deal info
  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('property_type')
    .eq('id', id)
    .single();

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const propertyType = body.propertyType || deal.property_type || 'Multifamily';

  // Get template docs for this property type
  const templateDocs = getTemplateForPropertyType(propertyType);

  // Check existing folders
  const { data: existingFolders } = await supabase
    .from('terminal_dd_folders')
    .select('id, name')
    .eq('deal_id', id);

  const folderMap = new Map<string, string>();
  existingFolders?.forEach(f => folderMap.set(f.name.toLowerCase(), f.id));

  // Create folders that don't exist
  let order = existingFolders?.length ?? 0;
  for (const folder of DD_FOLDERS) {
    const key = folder.name.toLowerCase();
    if (!folderMap.has(key)) {
      const { data: newFolder } = await supabase
        .from('terminal_dd_folders')
        .insert({
          deal_id: id,
          name: folder.name,
          icon: folder.icon,
          display_order: order++,
        })
        .select('id')
        .single();

      if (newFolder) {
        folderMap.set(key, newFolder.id as string);
      }
    }
  }

  // Check existing documents to avoid duplicates
  const { data: existingDocs } = await supabase
    .from('terminal_dd_documents')
    .select('name')
    .eq('deal_id', id);

  const existingNames = new Set((existingDocs ?? []).map(d => d.name.toLowerCase()));

  // Insert template documents as "not uploaded" placeholders
  let docsCreated = 0;
  for (const doc of templateDocs) {
    if (existingNames.has(doc.name.toLowerCase())) continue;

    // Find the folder
    const folderKey = doc.folder.toLowerCase();
    const folderId = folderMap.get(folderKey);
    if (!folderId) continue;

    await supabase.from('terminal_dd_documents').insert({
      deal_id: id,
      folder_id: folderId,
      name: doc.name,
      doc_status: 'notuploaded',
      is_verified: false,
      is_downloadable: false,
    });

    docsCreated++;
  }

  return NextResponse.json({
    success: true,
    docsCreated,
    totalTemplate: templateDocs.length,
    propertyType,
  });
}
