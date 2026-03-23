import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60; // Allow up to 60s for PDF processing

export async function POST(request: NextRequest) {
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

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['owner', 'employee'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  // Build content blocks with PDFs
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

  const fileDescriptions: string[] = [];
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mediaType = file.type === 'application/pdf' ? 'application/pdf' as const : 'application/pdf' as const;

    fileDescriptions.push(`- ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);

    contentBlocks.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    });
  }

  contentBlocks.push({
    type: 'text',
    text: `You are a commercial real estate analyst. I've uploaded ${files.length} document(s):
${fileDescriptions.join('\n')}

These may include an Offering Memorandum (OM) and/or a Letter of Intent (LOI).

IMPORTANT: If both an OM and LOI are present, the LOI contains the ACTUAL NEGOTIATED TERMS which override the OM's marketed terms. Use LOI values for: purchase price, deposit, closing timeline, DD period, special terms, financing terms.

Extract ALL of the following fields. If a field is not found, use null. Return ONLY valid JSON, no other text.

{
  "name": "Property name",
  "city": "City",
  "state": "State abbreviation (e.g. IL, NY, TX)",
  "property_type": "One of: Office, Retail, Industrial, Multifamily, Mixed-Use, Hospitality, Medical, Other",
  "square_footage": "Total square footage as string",
  "units": "Number of units (for multifamily) as string, or null",
  "class_type": "A, B, or C",
  "year_built": "Year as number or null",
  "occupancy": "Occupancy percentage as string (e.g. '95')",
  "purchase_price": "Purchase price as plain number string (e.g. '14200000')",
  "noi": "Net Operating Income as plain number string",
  "cap_rate": "Cap rate as string (e.g. '9.0')",
  "irr": "Projected IRR as string (e.g. '22.4') or null",
  "coc": "Cash on cash return as string or null",
  "dscr": "Debt service coverage ratio as string (e.g. '1.62') or null",
  "equity_required": "Equity required as plain number string or null",
  "loan_estimate": "Loan amount as plain number string or null",
  "seller_financing": true or false,
  "special_terms": "Any special terms as string, or 'None'",
  "deposit_amount": "Deposit amount as string (e.g. '$50,000') or null",
  "deposit_held_by": "Who holds the deposit or null",
  "neighborhood": "Neighborhood or submarket name or null",
  "metro_population": "Metro population as string or null",
  "job_growth": "Job growth percentage as string or null",
  "investment_highlights": ["Array of 3-5 key investment highlights as strings"],
  "acquisition_thesis": "2-3 sentence investment thesis",
  "dd_deadline_days": "Number of days for due diligence period, or null",
  "close_deadline_days": "Number of days to closing, or null",
  "assignment_fee": "Assignment fee as string (e.g. '3%') or null",
  "assignment_irr": "Assignment IRR as string or null",
  "acq_fee": "Acquisition fee as string or null",
  "asset_mgmt_fee": "Asset management fee as string or null",
  "gp_carry": "GP carry terms as string or null",
  "addresses": [
    {
      "label": "Building name or address label",
      "address": "Street address",
      "city": "City",
      "state": "State",
      "square_footage": "SF for this specific address or null",
      "units": "Units for this address or null"
    }
  ],
  "source_notes": "Brief note about which document each key value came from (OM vs LOI), especially where they differ"
}

If this is a portfolio with multiple addresses, fill in the addresses array. If single property, leave addresses as empty array [].

JSON only:`,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse extraction results', raw: text }, { status: 500 });
    }

    const extracted = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      success: true,
      data: extracted,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `AI extraction failed: ${message}` }, { status: 500 });
  }
}
