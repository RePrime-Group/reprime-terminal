import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { generateNdaPdf } from '@/lib/legal/nda-pdf';
import { formatNDADate } from '@/lib/legal/nda-text';
import { sendNdaSignedEmail } from '@/lib/email/send';

interface SignNDABody {
  fullName?: string;
  company?: string | null;
  title?: string | null;
  signatureDataUrl?: string | null;
}

function getClientIP(h: Headers): string | null {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() ?? null;
  return h.get('x-real-ip');
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only investors go through onboarding NDA. Owners/employees don't need it.
  const { data: profile } = await supabase
    .from('terminal_users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'investor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as SignNDABody;
  const fullName = body.fullName?.trim();
  if (!fullName) return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });

  const h = await headers();
  const ip = getClientIP(h);

  // If they've already signed a blanket NDA, treat the request as a no-op.
  const { data: existing } = await supabase
    .from('terminal_nda_signatures')
    .select('id')
    .eq('user_id', user.id)
    .eq('nda_type', 'blanket')
    .limit(1);
  if ((existing?.length ?? 0) > 0) return NextResponse.json({ ok: true, alreadySigned: true });

  const { error } = await supabase.from('terminal_nda_signatures').insert({
    user_id: user.id,
    nda_type: 'blanket',
    signer_name: fullName,
    signer_company: body.company?.trim() || null,
    signer_title: body.title?.trim() || null,
    ip_address: ip,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email the signer a PDF copy of the executed NDA. Best-effort — a mail
  // failure must never fail the signature that's already persisted.
  try {
    if (user.email) {
      const dateSigned = formatNDADate();
      const pdf = await generateNdaPdf({
        date: dateSigned,
        receivingPartyName: fullName,
        receivingPartyCompany: body.company?.trim() || undefined,
        receivingPartyTitle: body.title?.trim() || undefined,
        signatureDataUrl: body.signatureDataUrl || undefined,
        signed: true,
      });
      await sendNdaSignedEmail(user.email, fullName, dateSigned, Buffer.from(pdf).toString('base64'));
    }
  } catch (e) {
    console.error('NDA signed-copy email failed:', e);
  }

  return NextResponse.json({ ok: true });
}
