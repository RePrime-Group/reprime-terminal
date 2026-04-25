import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractTenantsWithClaude, insertExtractedTenants } from '@/lib/ai/extract-tenants';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only: extract tenant roster from an admin-uploaded document (PDF / CSV
// / Excel). The browser uploads the file directly to Supabase storage at a
// _temp/ path, then POSTs { tempPath, addressId? } here. We download, parse,
// hand off to Claude, insert rows, and ALWAYS delete the temp file in the
// finally block. A nightly pg_cron job (see migration) sweeps any _temp/
// objects that survive (e.g. browser closed before this route ran).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BYTES = 21 * 1024 * 1024;
const TEMP_PREFIX = '_temp/extract-tenants/';
const BUCKET = 'terminal-dd-documents';

interface RequestBody {
  tempPath?: string;
  addressId?: string | null;
}

function detectKind(path: string): 'pdf' | 'csv' | 'excel' | null {
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm')) return 'excel';
  return null;
}

// Convert all sheets in a workbook into a single tab-delimited text dump,
// preserving sheet boundaries with a header. Claude reads this fine.
function workbookToText(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', blankrows: false });
    if (csv.trim()) {
      parts.push(`### Sheet: ${sheetName}\n${csv}`);
    }
  }
  return parts.join('\n\n');
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

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const tempPath = body?.tempPath?.trim();
  const requestedAddressId = body?.addressId ?? null;

  if (!tempPath) {
    return NextResponse.json({ error: 'tempPath is required' }, { status: 400 });
  }
  // Guard against the client passing a path outside the temp prefix or
  // outside this deal's scope — the only legitimate caller is the upload
  // helper we ship in the rent-roll page.
  const expectedScope = `${TEMP_PREFIX}${dealId}/`;
  if (!tempPath.startsWith(expectedScope)) {
    return NextResponse.json(
      { error: 'tempPath must live under _temp/extract-tenants/{dealId}/' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: deal } = await admin
    .from('terminal_deals')
    .select('id, is_portfolio')
    .eq('id', dealId)
    .single();
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  // We use addressId only to tag inserted rows with the right building. The
  // AI prompt itself is NOT scoped by building label — admins explicitly want
  // every tenant in the uploaded file extracted, then they can reassign rows
  // between buildings in the rent roll UI.
  let targetAddressId: string | null = null;

  if (deal.is_portfolio) {
    if (!requestedAddressId) {
      // Always clean up the temp upload before returning.
      await admin.storage.from(BUCKET).remove([tempPath]);
      return NextResponse.json(
        { error: 'This is a portfolio deal. Pass addressId to pick a building.' },
        { status: 400 },
      );
    }
    const { data: address } = await admin
      .from('terminal_deal_addresses')
      .select('id')
      .eq('id', requestedAddressId)
      .eq('deal_id', dealId)
      .single();
    if (!address) {
      await admin.storage.from(BUCKET).remove([tempPath]);
      return NextResponse.json({ error: 'Address not found for this deal.' }, { status: 404 });
    }
    targetAddressId = address.id as string;
  }

  const kind = detectKind(tempPath);
  if (!kind) {
    await admin.storage.from(BUCKET).remove([tempPath]);
    return NextResponse.json(
      { error: 'Unsupported file type. Upload a PDF, CSV, or Excel (.xlsx/.xls) file.' },
      { status: 400 },
    );
  }

  // Wrap the entire extract path in try/finally so the temp object is always
  // removed — success, AI failure, parse failure, DB failure all flow through.
  try {
    const { data: fileData, error: dlError } = await admin.storage
      .from(BUCKET)
      .download(tempPath);
    if (dlError || !fileData) {
      return NextResponse.json(
        { error: `Failed to download upload: ${dlError?.message ?? 'unknown error'}` },
        { status: 500 },
      );
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: `File is ${(buffer.byteLength / 1024 / 1024).toFixed(0)}MB — max ${MAX_BYTES / 1024 / 1024}MB.` },
        { status: 400 },
      );
    }

    let extracted;
    try {
      if (kind === 'pdf') {
        extracted = await extractTenantsWithClaude({
          apiKey,
          source: { kind: 'pdf', name: tempPath.split('/').pop() ?? 'upload.pdf', bytes: buffer },
          buildingLabel: null,
        });
      } else {
        const text = kind === 'csv' ? buffer.toString('utf8') : workbookToText(buffer);
        if (!text.trim()) {
          return NextResponse.json(
            { error: 'The uploaded file appears to be empty.' },
            { status: 400 },
          );
        }
        extracted = await extractTenantsWithClaude({
          apiKey,
          source: { kind: 'text', name: tempPath.split('/').pop() ?? 'upload', text },
          buildingLabel: null,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: `AI extraction failed: ${message}` }, { status: 500 });
    }

    const { inserted, error: insertError } = await insertExtractedTenants({
      admin,
      dealId,
      addressId: targetAddressId,
      tenants: extracted.tenants,
    });
    if (insertError) {
      return NextResponse.json({ error: `Insert failed: ${insertError}` }, { status: 500 });
    }

    if (inserted === 0) {
      return NextResponse.json({
        success: true,
        inserted: 0,
        message: 'No tenants identified in the document.',
      });
    }
    return NextResponse.json({ success: true, inserted });
  } finally {
    // Best-effort temp cleanup. Errors here are intentionally swallowed —
    // the pg_cron sweep will pick up anything that slips through.
    await admin.storage.from(BUCKET).remove([tempPath]).catch(() => {});
  }
}
