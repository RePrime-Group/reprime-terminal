import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminAuth } from '@/lib/auth/requireAdmin';

// POST /api/dataroom/folders
// Create a folder (optionally nested under parent_id).
// Body: { deal_id: string, name: string, icon?: string, parent_id?: string | null }
export async function POST(request: NextRequest) {
  const auth = await getAdminAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.deal_id !== 'string' || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const name = body.name.trim();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const parentId: string | null = body.parent_id ?? null;
  const supabase = await createClient();

  // If parent_id provided, verify it belongs to the same deal (prevents cross-deal nesting).
  if (parentId) {
    const { data: parent } = await supabase
      .from('terminal_dd_folders')
      .select('id, deal_id')
      .eq('id', parentId)
      .single();
    if (!parent || parent.deal_id !== body.deal_id) {
      return NextResponse.json({ error: 'Invalid parent folder' }, { status: 400 });
    }
  }

  // Compute display_order = max(siblings) + 1. Siblings share (deal_id, parent_id).
  const siblingsQuery = supabase
    .from('terminal_dd_folders')
    .select('display_order')
    .eq('deal_id', body.deal_id);
  const { data: siblings } = parentId
    ? await siblingsQuery.eq('parent_id', parentId)
    : await siblingsQuery.is('parent_id', null);

  const nextOrder = (siblings ?? []).reduce(
    (max, s) => (s.display_order > max ? s.display_order : max),
    -1,
  ) + 1;

  const { data, error } = await supabase
    .from('terminal_dd_folders')
    .insert({
      deal_id: body.deal_id,
      name,
      icon: body.icon ?? null,
      parent_id: parentId,
      display_order: nextOrder,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ folder: data });
}
