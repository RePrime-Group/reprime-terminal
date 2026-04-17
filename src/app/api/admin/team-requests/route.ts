import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminAuth } from '@/lib/auth/requireAdmin';

export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth();
  if (!authResult.ok) return authResult.response;

  const status = request.nextUrl.searchParams.get('status') ?? 'pending';
  const admin = createAdminClient();

  const query = admin
    .from('terminal_team_requests')
    .select('id, investor_id, request_type, requested_total, target_user_id, permission_key, reason, status, reviewed_by, reviewed_at, admin_notes, created_at')
    .order('created_at', { ascending: false });

  const { data: requests } = status === 'all' ? await query : await query.eq('status', status);

  if (!requests || requests.length === 0) {
    return NextResponse.json({ requests: [] });
  }

  // Fetch related users to enrich the list
  const investorIds = [...new Set(requests.map((r) => r.investor_id))];
  const targetIds = [...new Set(requests.map((r) => r.target_user_id).filter(Boolean) as string[])];
  const reviewerIds = [...new Set(requests.map((r) => r.reviewed_by).filter(Boolean) as string[])];
  const allIds = [...new Set([...investorIds, ...targetIds, ...reviewerIds])];

  const { data: users } = await admin
    .from('terminal_users')
    .select('id, full_name, email, company_name, team_invite_limit')
    .in('id', allIds);

  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const enriched = requests.map((r) => ({
    ...r,
    investor: userMap.get(r.investor_id) ?? null,
    target_user: r.target_user_id ? userMap.get(r.target_user_id) ?? null : null,
    reviewer: r.reviewed_by ? userMap.get(r.reviewed_by) ?? null : null,
  }));

  return NextResponse.json({ requests: enriched });
}
