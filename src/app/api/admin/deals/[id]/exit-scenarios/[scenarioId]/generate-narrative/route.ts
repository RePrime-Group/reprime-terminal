import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only: generate a 2-4 sentence strategy narrative for a specific exit
// scenario using Claude. Reads the current scenario + deal context, writes
// the generated text back into strategy_narrative and marks
// ai_generated_narrative=true. Admin can further edit before presenting.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; scenarioId: string }> },
) {
  const { id: dealId, scenarioId } = await context.params;

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const admin = createAdminClient();
  const [{ data: scenario }, { data: deal }] = await Promise.all([
    admin.from('exit_scenarios').select('*').eq('id', scenarioId).eq('deal_id', dealId).single(),
    admin.from('terminal_deals').select('name, city, state, property_type, purchase_price, seller_credit, cap_rate, neighborhood, acquisition_thesis').eq('id', dealId).single(),
  ]);
  if (!scenario) return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  const toNum = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/[$,%\s]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  const purchasePrice = toNum(deal.purchase_price);
  const sellerCredit = toNum(deal.seller_credit);
  const netBasis = purchasePrice - sellerCredit;
  const entryCap = toNum(deal.cap_rate);
  const exitNOI = toNum(scenario.exit_noi);
  const exitCap = toNum(scenario.exit_cap_rate);
  const exitValue = exitCap > 0 ? exitNOI / (exitCap / 100) : 0;
  const additionalCapex = toNum(scenario.additional_capex);

  const locationLine = [deal.city, deal.state].filter(Boolean).join(', ');
  const propertyType = (deal.property_type as string) ?? 'commercial';

  const prompt = `You are writing an exit strategy narrative for a commercial real estate investment. The property is ${deal.name} in ${locationLine || 'its market'}, a ${propertyType} asset purchased at a ${entryCap.toFixed(2)}% cap rate for $${Math.round(netBasis).toLocaleString()} (net basis).

Scenario: ${scenario.scenario_name}
Exit Year: ${scenario.exit_year}
Exit Cap Rate: ${exitCap.toFixed(2)}%
Exit NOI: $${Math.round(exitNOI).toLocaleString()}
Exit Value: $${Math.round(exitValue).toLocaleString()}
Additional CapEx: $${Math.round(additionalCapex).toLocaleString()}
Buyer Profile: ${scenario.buyer_profile ?? 'N/A (refinance)'}
${deal.neighborhood ? `Neighborhood: ${deal.neighborhood}` : ''}
${deal.acquisition_thesis ? `Acquisition thesis: ${deal.acquisition_thesis}` : ''}

Write a concise 2-4 sentence description of this exit strategy. Be specific to the property and market. Do not use generic language. Focus on WHY this exit cap and NOI are achievable. Reference the property's specific attributes (tenant quality, location, lease terms) where relevant. For refinance scenarios, explain why this is the right moment to recapture equity.

Return only the narrative text, no headers, no quotes, no formatting.`;

  const anthropic = new Anthropic({ apiKey });
  let narrative: string;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    narrative = text.trim();
    if (!narrative) {
      return NextResponse.json({ error: 'Empty response from model' }, { status: 500 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `AI generation failed: ${message}` }, { status: 500 });
  }

  const { error: updateErr } = await admin
    .from('exit_scenarios')
    .update({ strategy_narrative: narrative, ai_generated_narrative: true })
    .eq('id', scenarioId);
  if (updateErr) {
    return NextResponse.json({ error: `Persist failed: ${updateErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, narrative });
}
