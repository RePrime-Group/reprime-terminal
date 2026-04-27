import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptSSNForDb } from '@/lib/kyc/encryption';
import {
  isAccredited,
  REQUIRED_TOP_LEVEL_FIELDS,
  type KYCFormData,
  type KYCSubmitPayload,
} from '@/lib/kyc/types';

function getValueByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function isNonEmpty(v: unknown): boolean {
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  return v !== null && v !== undefined;
}

function validateRequired(data: KYCFormData, hasSavedSSN: boolean): string | null {
  for (const path of REQUIRED_TOP_LEVEL_FIELDS) {
    // SSN can be empty in the submitted form when the user is keeping a
    // previously-saved encrypted value. The server already has it on disk.
    if (path === 'personal.ssn' && hasSavedSSN) continue;
    if (!isNonEmpty(getValueByPath(data, path))) {
      return `Missing required field: ${path}`;
    }
  }
  if (!data.certifiedTrue) return 'You must certify the information is true.';
  const a = data.accreditation;
  const anyChecked =
    a.individualIncome ||
    a.jointIncome ||
    a.netWorthExceeds1M ||
    a.licensedProfessional ||
    a.knowledgeableEmployee ||
    a.entityAssets ||
    a.notAccredited;
  if (!anyChecked) return 'Please check at least one accreditation option.';
  return null;
}

/**
 * Strips raw SSN out of the data before persistence. The SSN goes into the
 * encrypted column instead and must never land in the JSONB payload.
 */
function stripSSN(data: KYCFormData): KYCFormData {
  return {
    ...data,
    personal: { ...data.personal, ssn: '' },
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'investor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as KYCSubmitPayload | null;
  if (!body || typeof body !== 'object' || !body.data) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const partial = !!body.partial;
  const data = body.data;

  // Look up whether this user already has an encrypted SSN on file. Used
  // both for validation (treat empty SSN as satisfied if saved) and so we
  // know not to overwrite the column when the user kept the saved value.
  const { data: existingKyc } = await supabase
    .from('terminal_user_kyc')
    .select('ssn_encrypted')
    .eq('user_id', user.id)
    .maybeSingle();
  const hasSavedSSN = !!existingKyc?.ssn_encrypted;

  if (!partial) {
    const validationError = validateRequired(data, hasSavedSSN);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Encrypt SSN if present (might be empty during partial save). We send the
  // ciphertext as a Postgres bytea hex literal (`\xAABB...`) — handing
  // supabase-js a raw Buffer would JSON-serialise to `{type,data}` and store
  // NULL in the bytea column.
  const rawSSN = (data.personal?.ssn ?? '').trim();
  let ssnEncrypted: string | null = null;
  if (rawSSN) {
    try {
      ssnEncrypted = encryptSSNForDb(rawSSN);
    } catch (err) {
      console.error('[onboarding/kyc] SSN encryption failed:', err);
      return NextResponse.json(
        { error: 'Server cannot encrypt sensitive data right now. Please contact support.' },
        { status: 500 },
      );
    }
  }
  const dataForJsonb = stripSSN(data);

  const now = new Date().toISOString();
  const approveNow = !partial && isAccredited(data.accreditation);

  const row: Record<string, unknown> = {
    user_id: user.id,
    data: dataForJsonb,
    updated_at: now,
  };
  if (ssnEncrypted) row.ssn_encrypted = ssnEncrypted;
  if (!partial) {
    row.completed_at = now;
    row.approved = approveNow;
    if (approveNow) {
      row.approved_at = now;
      row.approved_by = 'auto';
    }
  }

  const { error } = await supabase
    .from('terminal_user_kyc')
    .upsert(row, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    partial,
    approved: !partial && approveNow,
  });
}
