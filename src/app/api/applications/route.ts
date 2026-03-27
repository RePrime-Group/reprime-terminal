import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendApplicationAckEmail, sendApplicationNotifyEmail } from '@/lib/email/send';

export async function POST(request: NextRequest) {
  const { full_name, email, company_name, phone } = await request.json();

  if (!full_name || !email) {
    return NextResponse.json({ error: 'full_name and email are required' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('terminal_membership_applications')
    .insert({ full_name, email, company_name: company_name || null, phone: phone || null })
    .select('id')
    .single();

  if (error) {
    console.error('[applications] Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send emails in background — don't block the response
  const origin = request.headers.get('origin') || 'https://reprimeterminal.com';

  Promise.allSettled([
    sendApplicationAckEmail(email, full_name),
    sendApplicationNotifyEmail({ full_name, email, company_name, phone }, origin),
  ]).then((results) => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[applications] Email ${i} failed:`, r.reason);
      }
    });
  });

  return NextResponse.json({ id: data.id });
}
