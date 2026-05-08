import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { getDealBriefData } from '@/lib/supabase/seller-brief';
import { buildSellerBriefPrompt } from '@/components/SellerBrief';

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only: generate the seller conversation brief data.
//
// 1. Authenticate as owner/employee.
// 2. Fetch the deal + addresses + tenants + capex via the shared utility.
// 3. Ask Claude for structured talking points.
// 4. Return everything to the brief page. If Claude fails or returns invalid
//    JSON we still return deal/tenant/capex data with aiTalkingPoints=null,
//    and the component falls back to investment_highlights.
// ─────────────────────────────────────────────────────────────────────────────

interface AiTalkingPoints {
  opener?: string;
  rent_plays?: string[];
  risk_flags?: string[];
  value_story?: string[];
  leverage_points?: string[];
  ask_list?: string[];
}

export async function POST(request: NextRequest) {
  let dealId: string | undefined;
  try {
    const body = (await request.json()) as { dealId?: unknown };
    if (typeof body?.dealId === 'string' && body.dealId.length > 0) {
      dealId = body.dealId;
    }
  } catch {
    // fall through — handled below
  }
  if (!dealId) {
    return NextResponse.json({ error: 'Missing dealId' }, { status: 400 });
  }

  // Auth — same pattern as exit-scenarios/generate.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['owner', 'employee'].includes(profile.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all the brief inputs.
  let data: Awaited<ReturnType<typeof getDealBriefData>>;
  try {
    data = await getDealBriefData(dealId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load deal data';
    const status = message === 'Deal not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const { deal, addresses, tenants, capexItems } = data;

  // Anthropic call — non-fatal: any failure returns null talking points so
  // the component falls back to investment_highlights.
  let aiTalkingPoints: AiTalkingPoints | null = null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const prompt = buildSellerBriefPrompt(deal, tenants, capexItems, addresses);
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      });
      const text =
        response.content[0]?.type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiTalkingPoints = JSON.parse(jsonMatch[0]) as AiTalkingPoints;
      }
    } catch {
      aiTalkingPoints = null;
    }
  }

  return NextResponse.json({
    deal,
    addresses,
    tenants,
    capexItems,
    aiTalkingPoints,
  });
}
