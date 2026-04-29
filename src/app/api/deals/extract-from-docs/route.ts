import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

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

  const body = await request.json();
  const { storagePaths } = body;

  // Support both: direct file upload (small files) and storage paths (large files)
  if (!storagePaths || !Array.isArray(storagePaths) || storagePaths.length === 0) {
    return NextResponse.json({ error: 'No files provided. Send storagePaths array.' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  // Download PDFs, extract text, and send text to Claude (avoids API size limits)
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  const fileDescriptions: string[] = [];

  for (const sp of storagePaths) {
    const { data: fileData, error: dlError } = await supabase.storage
      .from('terminal-dd-documents')
      .download(sp.path);

    if (dlError || !fileData) {
      return NextResponse.json({ error: `Failed to download ${sp.name}: ${dlError?.message}` }, { status: 500 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const fileSizeMB = buffer.byteLength / 1024 / 1024;
    fileDescriptions.push(`- ${sp.name} (${fileSizeMB.toFixed(1)} MB)`);

    // Anthropic API limit is ~25MB total request. Base64 adds 33% overhead.
    // Only send PDFs under 15MB as documents. Larger ones get skipped with a note.
    const MAX_PDF_BYTES = 15 * 1024 * 1024;

    if (buffer.byteLength <= MAX_PDF_BYTES) {
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf' as const,
          data: buffer.toString('base64'),
        },
      });
    } else {
      // PDF too large to send — add a text note so Claude knows it exists
      contentBlocks.push({
        type: 'text',
        text: `[DOCUMENT: ${sp.name} — ${fileSizeMB.toFixed(0)}MB — TOO LARGE TO PROCESS DIRECTLY. This is likely an Offering Memorandum. Extract what you can from the other uploaded documents. The admin will need to verify and supplement any missing data from this large document.]`,
      });
    }
  }

  contentBlocks.push({
    type: 'text',
    text: `You are a commercial real estate underwriter. I've uploaded ${storagePaths.length} document(s):
${fileDescriptions.join('\n')}

These may include an Offering Memorandum (OM) and/or a Letter of Intent (LOI).

CRITICAL RULES:
1. If BOTH an OM and LOI are present, the LOI contains the ACTUAL NEGOTIATED TERMS. The LOI OVERRIDES the OM for: purchase price, deposit, closing timeline, DD period, special terms, financing terms.
2. You MUST CALCULATE ALL financial metrics yourself — do NOT copy them from the OM. Use these DEFAULT ASSUMPTIONS unless the documents specify otherwise:
   - LTV: 70% (Loan = Purchase Price × 0.70)
   - Interest Rate: 6.5% (unless stated in docs)
   - Amortization: 30 years
   - Hold Period: 5 years for IRR calculation
3. REQUIRED CALCULATIONS (show your work in source_notes):
   - loan_estimate = Purchase Price × 0.70
   - equity_required = Purchase Price × 0.30
   - Annual Debt Service = Loan Amount × Interest Rate (simplified for IO estimate)
   - cap_rate = NOI / Purchase Price × 100
   - DSCR = NOI / Annual Debt Service
   - Cash Flow = NOI - Annual Debt Service
   - coc = Cash Flow / Equity × 100
   - For IRR: estimate using cash flow + exit value at same cap rate after hold period
4. purchase_price, noi, equity_required, loan_estimate should be PLAIN NUMBERS as strings (no $ or commas). Example: "2333500" not "$2,333,500"

PORTFOLIO DETECTION (read carefully — this is where mistakes happen):
- An OM is a PORTFOLIO only when it markets MULTIPLE DISTINCT PROPERTIES as one deal.
  Positive signals: multiple separate street addresses, per-property rent rolls,
  per-property financial breakouts, language like "portfolio", "collection",
  "package", "X-Property Offering", "Y-Building Portfolio".
- A single building is NOT a portfolio — even if it has many tenants, many suites,
  or several parcels at one address.
- A strip center with multiple storefronts at ONE street address is NOT a portfolio.
- Two or more buildings at DIFFERENT street addresses sold as one deal IS a portfolio.

Output accordingly:
- Single property: set is_portfolio=false, fill "address" with the street address, and addresses MUST be [].
- Portfolio: set is_portfolio=true, set "address"=null, and addresses MUST have >= 2 entries.

Extract ALL fields. If not found, use null. Return ONLY valid JSON.

{
  "name": "Property name (for portfolio, a portfolio-level name)",
  "is_portfolio": true or false,
  "address": "Street address for single-property deals, null for portfolios",
  "city": "City (for portfolio, pick primary or metro)",
  "state": "State abbreviation (e.g. IL, NY, TX)",
  "property_type": "One of: Office, Retail, Industrial, Multifamily, Mixed-Use, Hospitality, Medical, Other",
  "square_footage": "Total square footage as string",
  "units": "Number of units (for multifamily) as string, or null",
  "class_type": "A, B, or C",
  "year_built": "Year as number or null",
  "occupancy": "Occupancy percentage as string (e.g. '95')",
  "purchase_price": "PLAIN NUMBER from LOI if available, else OM (e.g. '14200000')",
  "noi": "Net Operating Income as PLAIN NUMBER string (e.g. '1278000')",
  "cap_rate": "CALCULATE: NOI / purchase_price * 100, string with 1 decimal (e.g. '10.2')",
  "irr": "CALCULATE: estimated IRR based on cash flow + exit at same cap over 5yr hold, as string (e.g. '18.5')",
  "coc": "CALCULATE: (NOI - Annual Debt Service) / Equity * 100, as string (e.g. '11.2')",
  "dscr": "CALCULATE: NOI / Annual Debt Service, as string (e.g. '1.62')",
  "equity_required": "CALCULATE: Purchase Price * 0.30, as PLAIN NUMBER string (e.g. '700000')",
  "loan_estimate": "CALCULATE: Purchase Price * 0.70, as PLAIN NUMBER string (e.g. '1633450')",
  "seller_financing": true or false,
  "special_terms": "Any special terms from LOI first, then OM, or 'None'",
  "deposit_amount": "From LOI if available (e.g. '$50,000') or null",
  "deposit_held_by": "Who holds the deposit or null",
  "neighborhood": "Neighborhood or submarket name or null",
  "metro_population": "Metro population as string or null",
  "job_growth": "Job growth percentage as string or null",
  "investment_highlights": ["Array of 3-5 key investment highlights as strings"],
  "acquisition_thesis": "2-3 sentence investment thesis based on the ACTUAL deal terms (LOI price, not OM asking price)",
  "dd_deadline_days": "Number of days for due diligence period from LOI, or null",
  "close_deadline_days": "Number of days to closing from LOI, or null",
  "assignment_fee": "Assignment fee as string (e.g. '3%') or null",
  "assignment_irr": "Assignment IRR as string or null",
  "acq_fee": "Acquisition fee as string or null",
  "asset_mgmt_fee": "Asset management fee as string or null",
  "gp_carry": "GP carry terms as string or null",
  "loan_fee": "Loan fee/points as string or null",
  "addresses": [
    {
      "label": "Building name or address label",
      "address": "Street address",
      "city": "City",
      "state": "State",
      "square_footage": "SF for this specific address or null",
      "units": "Units for this address or null",
      "year_built": "Year as number or null",
      "noi": "NOI for this specific address as plain number or null"
    }
  ],
  "tenants": [
    {
      "tenant_name": "Tenant name, or 'Vacant' for empty spaces",
      "address_label": "For PORTFOLIO deals only: the label of the building this tenant belongs to. Must exactly match one of the 'label' values in the 'addresses' array (case-insensitive). Null for single-property deals or when the tenant's building cannot be determined.",
      "suite_unit": "Suite or unit number, null if unknown",
      "leased_sf": "Leased square footage as plain number, e.g. 25000",
      "annual_base_rent": "Annual base rent as plain number (no $, no commas)",
      "rent_per_sf": "Rent per SF as plain number, e.g. 6.50",
      "lease_type": "One of: NNN, NN, Modified Gross, Gross, Ground. Default NNN if unknown.",
      "lease_start_date": "e.g. '01/2020' or '2020-01-01' or null",
      "lease_end_date": "e.g. '12/2031' or null",
      "option_renewals": "e.g. '2x5yr' or null",
      "escalation_structure": "e.g. '2% annual', 'CPI', '10% at year 5', or null",
      "is_anchor": true,
      "is_vacant": false,
      "tenant_industry": "e.g. 'Grocery', 'Medical', 'Restaurant', or null",
      "guarantor": "Corporate, Personal, None, or null",
      "tenant_credit_rating": "One of: Investment Grade, National Credit, Regional, Local, Unknown",
      "market_rent_estimate": "For vacant spaces only: estimated market rent per SF as plain number"
    }
  ],
  "source_notes": "Explain which values came from OM vs LOI. Highlight any differences (e.g. 'OM asking $2.5M, LOI negotiated $2.33M'). Show your cap rate calculation. Also justify is_portfolio — one sentence on why this is or is not a portfolio."
}

TENANT EXTRACTION:
- Extract the COMPLETE tenant roster if the OM includes one.
- Include VACANT SPACES as entries with is_vacant=true (tenant_name="Vacant").
- Best-effort: use null for fields not stated in the document. Do NOT fabricate.
- If the OM only says "anchored by Kroger" with no full roster, return one entry with tenant_name="Kroger", is_anchor=true, everything else null.
- If there is no tenant information at all, return "tenants": [].
- PORTFOLIO DEALS: every tenant MUST include address_label, and the value must match one of the labels in the 'addresses' array exactly (case-insensitive). Use null only when the building genuinely cannot be determined.
- SINGLE-PROPERTY DEALS: always set address_label=null.

JSON only:`,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse extraction results', raw: text }, { status: 500 });
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Safety net: a portfolio must have >= 2 distinct addresses. If the model
    // returned is_portfolio=true with fewer entries, or produced a single-entry
    // addresses array while claiming single-property, force it back to single.
    const addrCount = Array.isArray(extracted.addresses) ? extracted.addresses.length : 0;
    if (addrCount < 2) {
      extracted.is_portfolio = false;
      if (addrCount === 1 && !extracted.address) {
        // Lift the one address entry's street up to the top-level field so we
        // don't lose it when we discard the addresses array.
        extracted.address = extracted.addresses[0]?.address ?? null;
      }
      extracted.addresses = [];
    } else {
      extracted.is_portfolio = true;
      extracted.address = null;
    }

    return NextResponse.json({
      success: true,
      data: extracted,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
    });
  } catch (err: unknown) {
    console.error("err", err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `AI extraction failed: ${message}` }, { status: 500 });
  }
}
