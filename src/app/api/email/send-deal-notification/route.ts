import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendDealNotificationEmail } from '@/lib/email/send';

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

  // Verify admin
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

  const { dealId } = await request.json();

  if (!dealId) {
    return NextResponse.json({ error: 'dealId is required' }, { status: 400 });
  }

  // Fetch deal details
  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('name, city, state, property_type, status')
    .eq('id', dealId)
    .single();

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Fetch all active investors
  const { data: investors } = await supabase
    .from('terminal_users')
    .select('email')
    .eq('role', 'investor')
    .eq('is_active', true);

  if (!investors || investors.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://terminal.reprime.com';
  const portalUrl = `${baseUrl}/en/portal`;

  let sent = 0;
  const errors: string[] = [];

  for (const investor of investors) {
    try {
      const { error } = await sendDealNotificationEmail(investor.email, deal, portalUrl);
      if (error) {
        errors.push(`${investor.email}: ${error.message}`);
      } else {
        sent++;
      }
    } catch {
      errors.push(`${investor.email}: send failed`);
    }
  }

  return NextResponse.json({ success: true, sent, errors });
}
