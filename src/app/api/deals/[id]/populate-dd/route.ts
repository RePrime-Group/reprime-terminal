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

  // Normalize folder names: "01_Marketing" → "marketing", "02_Market_Research" → "market research"
  function normalizeFolderName(name: string): string {
    return name.toLowerCase().replace(/^\d+_/, '').replace(/_/g, ' ').trim();
  }

  const folderMap = new Map<string, string>();
  existingFolders?.forEach(f => {
    folderMap.set(normalizeFolderName(f.name), f.id);
    folderMap.set(f.name.toLowerCase(), f.id); // also map raw name
  });

  // Only create folders if the deal has NO folders yet (first-time setup)
  // This prevents duplicate folder creation
  let order = existingFolders?.length ?? 0;
  const shouldCreateFolders = !existingFolders || existingFolders.length === 0;

  for (const folder of DD_FOLDERS) {
    const key = normalizeFolderName(folder.name);
    if (shouldCreateFolders && !folderMap.has(key)) {
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

  // Also convert pipeline tasks into DD documents
  const { data: pipelineTasks } = await supabase
    .from('terminal_deal_tasks')
    .select('id, name, status, stage')
    .eq('deal_id', id);

  let tasksConverted = 0;
  if (pipelineTasks) {
    // Map task names to likely folders based on keywords
    const taskFolderMap: Record<string, string> = {};
    for (const [key, fid] of folderMap.entries()) {
      taskFolderMap[key] = fid;
    }

    for (const task of pipelineTasks) {
      if (existingNames.has(task.name.toLowerCase())) continue;

      // Determine which folder this task belongs to based on name
      const tl = task.name.toLowerCase();
      let targetFolderId: string | undefined;

      if (tl.includes('om') || tl.includes('marketing') || tl.includes('photo') || tl.includes('listing')) {
        targetFolderId = folderMap.get('marketing');
      } else if (tl.includes('costar') || tl.includes('market') || tl.includes('research') || tl.includes('narrative')) {
        targetFolderId = folderMap.get('market research');
      } else if (tl.includes('loi') || tl.includes('psa') || tl.includes('title') || tl.includes('legal') || tl.includes('entity') || tl.includes('contract')) {
        targetFolderId = folderMap.get('legal');
      } else if (tl.includes('financial') || tl.includes('rent roll') || tl.includes('t-12') || tl.includes('model') || tl.includes('proforma')) {
        targetFolderId = folderMap.get('financials');
      } else if (tl.includes('lease') || tl.includes('tenant') || tl.includes('estoppel')) {
        targetFolderId = folderMap.get('leases');
      } else if (tl.includes('environment') || tl.includes('phase') || tl.includes('esa')) {
        targetFolderId = folderMap.get('dd reports');
      } else if (tl.includes('inspect') || tl.includes('condition') || tl.includes('roof') || tl.includes('hvac') || tl.includes('site visit')) {
        targetFolderId = folderMap.get('site visit') || folderMap.get('dd reports');
      } else if (tl.includes('insurance')) {
        targetFolderId = folderMap.get('insurance');
      } else if (tl.includes('presentation') || tl.includes('hebrew') || tl.includes('english') || tl.includes('deck')) {
        targetFolderId = folderMap.get('presentations');
      } else if (tl.includes('investor') || tl.includes('lp')) {
        targetFolderId = folderMap.get('investor materials');
      } else if (tl.includes('closing') || tl.includes('post')) {
        targetFolderId = folderMap.get('post-closing');
      } else if (tl.includes('financ') || tl.includes('lend') || tl.includes('loan') || tl.includes('debt')) {
        targetFolderId = folderMap.get('financing / lenders');
      }

      // Default to first available folder if no match
      if (!targetFolderId) {
        targetFolderId = folderMap.values().next().value as string | undefined;
      }
      if (!targetFolderId) continue;

      // Map task status to doc status
      const docStatus = task.status === 'completed' ? 'verified'
        : task.status === 'in_progress' ? 'uploaded'
        : 'notuploaded';

      await supabase.from('terminal_dd_documents').insert({
        deal_id: id,
        folder_id: targetFolderId,
        name: task.name,
        doc_status: docStatus,
        is_verified: task.status === 'completed',
        is_downloadable: false,
      });

      existingNames.add(task.name.toLowerCase());
      tasksConverted++;
    }
  }

  return NextResponse.json({
    success: true,
    docsCreated,
    tasksConverted,
    totalTemplate: templateDocs.length,
    totalTasks: pipelineTasks?.length ?? 0,
    propertyType,
  });
}
