import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { DD_FOLDERS } from '@/lib/dd-templates';

// Seeds the standard DD folder set on a deal. Idempotent — if the deal
// already has any folders, no folders are added. Only creates folders;
// template documents are intentionally NOT inserted as placeholders
// (placeholder rows with storage_path = NULL cluttered the UI and added no
// value — admins create real documents by uploading files).
export async function POST(
  _request: NextRequest,
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

  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('id')
    .eq('id', id)
    .single();

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  const { data: existingFolders } = await supabase
    .from('terminal_dd_folders')
    .select('id, name')
    .eq('deal_id', id);

  // Idempotent: if the deal already has folders, do nothing.
  if (existingFolders && existingFolders.length > 0) {
    return NextResponse.json({
      success: true,
      foldersCreated: 0,
      skipped: true,
      reason: 'Deal already has folders',
    });
  }

  let order = 0;
  let foldersCreated = 0;

  for (const folder of DD_FOLDERS) {
    const { error } = await supabase
      .from('terminal_dd_folders')
      .insert({
        deal_id: id,
        name: folder.name,
        icon: folder.icon,
        display_order: order++,
      });

    if (!error) foldersCreated++;
  }

  return NextResponse.json({
    success: true,
    foldersCreated,
    total: DD_FOLDERS.length,
  });
}
