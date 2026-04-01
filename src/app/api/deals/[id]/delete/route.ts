import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dealId } = await params;
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

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify admin role
  const { data: terminalUser } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!terminalUser || terminalUser.role === 'investor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify deal exists
  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('id, name, om_storage_path')
    .eq('id', dealId)
    .single();

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  // ── 1. Collect all storage paths to delete ──

  const [
    { data: photos },
    { data: ddDocs },
    { data: taskAttachments },
    { data: addresses },
  ] = await Promise.all([
    supabase.from('terminal_deal_photos').select('storage_path').eq('deal_id', dealId),
    supabase.from('terminal_dd_documents').select('storage_path').eq('deal_id', dealId),
    supabase.from('terminal_task_attachments').select('storage_path').eq('deal_id', dealId),
    supabase.from('terminal_deal_addresses').select('om_storage_path').eq('deal_id', dealId),
  ]);

  // ── 2. Delete files from storage buckets ──

  // Deal photos
  const photoPaths = (photos ?? []).map(p => p.storage_path).filter(Boolean);
  if (photoPaths.length > 0) {
    await supabase.storage.from('terminal-deal-photos').remove(photoPaths);
  }

  // DD documents + task attachments (both in terminal-dd-documents bucket)
  const ddPaths = (ddDocs ?? []).map(d => d.storage_path).filter((p): p is string => !!p);
  const attachmentPaths = (taskAttachments ?? []).map(a => a.storage_path).filter(Boolean);
  const allDDPaths = [...ddPaths, ...attachmentPaths];
  if (allDDPaths.length > 0) {
    // Supabase storage remove has a limit per call, batch in chunks of 100
    for (let i = 0; i < allDDPaths.length; i += 100) {
      await supabase.storage.from('terminal-dd-documents').remove(allDDPaths.slice(i, i + 100));
    }
  }

  // OM files on deal and addresses
  const omPaths = [
    deal.om_storage_path,
    ...(addresses ?? []).map(a => a.om_storage_path),
  ].filter((p): p is string => !!p);
  if (omPaths.length > 0) {
    await supabase.storage.from('terminal-dd-documents').remove(omPaths);
  }

  // ── 3. Delete all related database records ──
  // Order matters: delete children before parents

  const deleteOps = [
    supabase.from('terminal_task_attachments').delete().eq('deal_id', dealId),
    supabase.from('terminal_deal_tasks').delete().eq('deal_id', dealId),
    supabase.from('terminal_deal_stages').delete().eq('deal_id', dealId),
    supabase.from('terminal_dd_documents').delete().eq('deal_id', dealId),
    supabase.from('terminal_dd_folders').delete().eq('deal_id', dealId),
    supabase.from('terminal_deal_photos').delete().eq('deal_id', dealId),
    supabase.from('terminal_deal_addresses').delete().eq('deal_id', dealId),
    supabase.from('terminal_deal_messages').delete().eq('deal_id', dealId),
    supabase.from('terminal_deal_commitments').delete().eq('deal_id', dealId),
    supabase.from('terminal_deal_subscriptions').delete().eq('deal_id', dealId),
    supabase.from('terminal_watchlist').delete().eq('deal_id', dealId),
    supabase.from('terminal_activity_log').delete().eq('deal_id', dealId),
    supabase.from('terminal_meetings').delete().eq('deal_id', dealId),
    supabase.from('terminal_notifications').delete().eq('deal_id', dealId),
  ];

  await Promise.all(deleteOps);

  // ── 4. Delete the deal itself ──
  const { error } = await supabase
    .from('terminal_deals')
    .delete()
    .eq('id', dealId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete deal', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, name: deal.name });
}
