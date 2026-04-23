import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only: parse a free-form property-condition narrative into structured
// capex_items rows. Text-only (no PDF), so this is much cheaper than the
// OM tenant extraction. Inserted rows are marked ai_extracted=true so the
// admin can review them in the UI before publishing.
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedCapExItem {
  component_name: string | null;
  current_condition: string | null;
  year_last_replaced: string | null;
  useful_life_remaining: string | null;
  estimated_replacement_cost: number | null;
  priority: string | null;
  notes: string | null;
}

const CONDITION_VALUES = new Set(['Excellent', 'Good', 'Fair', 'Poor', 'Unknown']);
const PRIORITY_VALUES = new Set(['Immediate', 'Near-Term', 'During Hold', 'Post-Hold', 'N/A']);

function normalizeItem(raw: Record<string, unknown>): ExtractedCapExItem {
  const get = (k: string) => (raw[k] === undefined ? null : raw[k]);
  const asString = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : v === null || v === undefined ? null : String(v);
  const asNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const condition = asString(get('current_condition'));
  const priority = asString(get('priority'));

  return {
    component_name: asString(get('component_name')),
    current_condition: condition && CONDITION_VALUES.has(condition) ? condition : null,
    year_last_replaced: asString(get('year_last_replaced')),
    useful_life_remaining: asString(get('useful_life_remaining')),
    estimated_replacement_cost: asNumber(get('estimated_replacement_cost')),
    priority: priority && PRIORITY_VALUES.has(priority) ? priority : null,
    notes: asString(get('notes')),
  };
}

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as {
    addressId?: string | null;
    narrative?: string;
  } | null;

  const narrative = (body?.narrative ?? '').trim();
  const requestedAddressId = body?.addressId ?? null;

  if (!narrative) {
    return NextResponse.json({ error: 'Narrative text is required.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Validate the deal + address combination and capture the building label
  // for context (helps AI attribute components correctly on portfolio deals).
  const { data: deal } = await admin
    .from('terminal_deals')
    .select('id, is_portfolio')
    .eq('id', dealId)
    .single();

  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  let buildingLabel: string | null = null;
  let targetAddressId: string | null = null;

  if (deal.is_portfolio) {
    if (!requestedAddressId) {
      return NextResponse.json(
        { error: 'This is a portfolio deal. Pass addressId in the request body to pick a building.' },
        { status: 400 },
      );
    }
    const { data: address } = await admin
      .from('terminal_deal_addresses')
      .select('id, label')
      .eq('id', requestedAddressId)
      .eq('deal_id', dealId)
      .single();
    if (!address) {
      return NextResponse.json({ error: 'Address not found for this deal.' }, { status: 404 });
    }
    targetAddressId = address.id as string;
    buildingLabel = (address.label as string) ?? null;
  }

  const anthropic = new Anthropic({ apiKey });

  const buildingContext = buildingLabel
    ? ` These notes describe the building labeled "${buildingLabel}" in a portfolio deal.`
    : '';

  const prompt = `You are a commercial real estate underwriter. Parse the following property condition notes into structured capital expenditure items.${buildingContext}

For each building system or component mentioned, extract:
- component_name (the system: Roof, HVAC, Parking Lot, Elevator, Fire Suppression, Plumbing, Electrical, Facade, etc.)
- current_condition (one of: Excellent, Good, Fair, Poor, Unknown)
- year_last_replaced (year as string, e.g. "2018", or "Original [year]" if never replaced, or null)
- useful_life_remaining (e.g. "15+ years", "3-5 years", "Immediate", or null)
- estimated_replacement_cost (plain number, no $ or commas; 0 if no cost mentioned)
- priority (one of: Immediate, Near-Term, During Hold, Post-Hold, N/A)
- notes (any additional context — warranties, inspection findings, quotes)

Guidance on priority mapping:
- "needs replacement now", "immediate", "urgent" → Immediate
- "1-2 years", "soon", "within 2 years" → Near-Term
- "3-5 years", "during hold", "mid-term" → During Hold
- "15+ years", "end of useful life is after hold", "long term" → Post-Hold
- informational only or cannot determine → N/A

If a field cannot be determined, set it to null. Do NOT invent information not present in the notes.

Return ONLY valid JSON in this shape:
{
  "items": [
    {
      "component_name": "Roof",
      "current_condition": "Good",
      "year_last_replaced": "2021",
      "useful_life_remaining": "15+ years",
      "estimated_replacement_cost": 0,
      "priority": "Post-Hold",
      "notes": "Replaced 5 years ago"
    }
  ]
}

If no components are mentioned, return {"items": []}.

JSON only.

---
Notes:
${narrative}`;

  let extracted: { items: ExtractedCapExItem[] } = { items: [] };
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse extraction output', raw: text }, { status: 500 });
    }
    const parsed = JSON.parse(jsonMatch[0]) as { items?: Record<string, unknown>[] };
    extracted = {
      items: Array.isArray(parsed.items) ? parsed.items.map(normalizeItem) : [],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `AI parsing failed: ${message}` }, { status: 500 });
  }

  // Persist the raw narrative to the appropriate scope so admins can see
  // what was parsed later. Scope is the deal for single-property, the
  // address for portfolios.
  if (targetAddressId) {
    await admin
      .from('terminal_deal_addresses')
      .update({ capex_narrative: narrative })
      .eq('id', targetAddressId);
  } else {
    await admin
      .from('terminal_deals')
      .update({ capex_narrative: narrative })
      .eq('id', dealId);
  }

  // Compute next sort_order scoped to the deal (single ordering across all
  // buildings — keeps reorder arrows simple and mirrors rent-roll).
  const { data: existing } = await admin
    .from('capex_items')
    .select('sort_order')
    .eq('deal_id', dealId);
  const maxOrder = existing && existing.length > 0
    ? Math.max(...existing.map((r) => (r.sort_order as number) ?? 0))
    : -1;

  const rows = extracted.items
    .filter((i) => i.component_name)
    .map((i, idx) => ({
      deal_id: dealId,
      address_id: targetAddressId,
      component_name: i.component_name as string,
      current_condition: i.current_condition ?? 'Unknown',
      year_last_replaced: i.year_last_replaced,
      useful_life_remaining: i.useful_life_remaining,
      estimated_replacement_cost: i.estimated_replacement_cost,
      priority: i.priority ?? 'During Hold',
      notes: i.notes,
      sort_order: maxOrder + 1 + idx,
      ai_extracted: true,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ success: true, inserted: 0, message: 'No components identified in the narrative.' });
  }

  const { error: insertError } = await admin.from('capex_items').insert(rows);
  if (insertError) {
    return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, inserted: rows.length });
}
