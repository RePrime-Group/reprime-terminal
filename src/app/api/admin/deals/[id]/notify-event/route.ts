import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  dispatchNewDeal,
  dispatchDealActivity,
  dispatchDocumentUploads,
} from '@/lib/notifications/dispatch';
import { DEAL_ACTIVITY_WATCH_FIELDS, type DealActivityField } from '@/lib/notifications/types';

type NotifyBody =
  | { type: 'new_deal' }
  | { type: 'deal_activity'; changedFields: string[] }
  | { type: 'document_upload'; docNames: string[] };

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: dealId } = await context.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['owner', 'employee'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as NotifyBody | null;
  if (!body || !body.type) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: deal } = await admin
    .from('terminal_deals')
    .select('id, name, city, state, property_type, status')
    .eq('id', dealId)
    .single();

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  if (body.type === 'new_deal') {
    if (deal.status !== 'published') {
      return NextResponse.json({ error: 'Deal is not published' }, { status: 400 });
    }
    const result = await dispatchNewDeal(admin, deal);
    return NextResponse.json({ success: true, ...result });
  }

  if (body.type === 'deal_activity') {
    const watchSet = new Set<string>(DEAL_ACTIVITY_WATCH_FIELDS);
    const fields = (body.changedFields ?? []).filter((f): f is DealActivityField => watchSet.has(f));
    if (fields.length === 0) return NextResponse.json({ success: true, sent: 0 });
    const result = await dispatchDealActivity(admin, deal, fields);
    return NextResponse.json({ success: true, ...result });
  }

  if (body.type === 'document_upload') {
    const docs = (body.docNames ?? [])
      .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      .map((name) => ({ name }));
    if (docs.length === 0) return NextResponse.json({ success: true, sent: 0 });
    const result = await dispatchDocumentUploads(admin, deal, docs);
    return NextResponse.json({ success: true, ...result });
  }

  return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
}
