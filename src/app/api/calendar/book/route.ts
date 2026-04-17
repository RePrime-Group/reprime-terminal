import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createCalendarEvent } from '@/lib/google/calendar';
import { sendMeetingConfirmation } from '@/lib/email/send';
import { getInvestorAuth, permissionDenied } from '@/lib/auth/requireInvestor';

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

  const authResult = await getInvestorAuth();
  if (!authResult.ok) return authResult.response;
  const denied = permissionDenied(authResult.user, 'schedule_meetings');
  if (denied) return denied;
  const user = { id: authResult.user.userId };

  const { dealId, startTime, notes } = await request.json();

  if (!dealId || !startTime) {
    return NextResponse.json({ error: 'dealId and startTime are required' }, { status: 400 });
  }

  // Get investor info
  const { data: investor } = await supabase
    .from('terminal_users')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  if (!investor) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get deal info
  const { data: deal } = await supabase
    .from('terminal_deals')
    .select('name, city, state')
    .eq('id', dealId)
    .single();

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  // Get admin contact email from settings
  const { data: settingsData } = await supabase
    .from('terminal_settings')
    .select('value')
    .eq('key', 'contact_email')
    .single();

  const adminEmail = settingsData?.value
    ? String(settingsData.value).replace(/"/g, '')
    : '';

  // Calculate end time (30 min meeting)
  const start = new Date(startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  // Insert meeting record in DB
  const { data: meeting, error: dbError } = await supabase
    .from('terminal_meetings')
    .insert({
      deal_id: dealId,
      investor_id: user.id,
      scheduled_at: startTime,
      status: 'scheduled',
      notes: notes || null,
    })
    .select('id')
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Try to create Google Calendar event
  let calendarEvent = null;
  try {
    const attendees = [investor.email];
    if (adminEmail) attendees.push(adminEmail);

    calendarEvent = await createCalendarEvent({
      summary: `RePrime Terminal Beta — ${deal.name} Discussion`,
      description: [
        `Deal: ${deal.name} — ${deal.city}, ${deal.state}`,
        `Investor: ${investor.full_name} (${investor.email})`,
        notes ? `Notes: ${notes}` : '',
        '',
        'This meeting was scheduled via RePrime Terminal Beta.',
      ].filter(Boolean).join('\n'),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      attendeeEmails: attendees,
    });
  } catch (err) {
    console.error('Google Calendar event creation failed:', err);
    // Meeting is still saved in DB even if calendar fails
  }

  // Log activity
  await supabase.from('terminal_activity_log').insert({
    user_id: user.id,
    deal_id: dealId,
    action: 'meeting_requested',
    metadata: {
      meeting_id: meeting?.id,
      scheduled_at: startTime,
      calendar_event_id: calendarEvent?.eventId ?? null,
    },
  });

  // Send confirmation emails
  const emailData = {
    investorName: investor.full_name,
    dealName: deal.name,
    city: deal.city,
    state: deal.state,
    dateTime: startTime,
    calendarLink: calendarEvent?.htmlLink,
  };

  try {
    // Email to investor
    await sendMeetingConfirmation(investor.email, emailData);
    // Email to admin
    if (adminEmail) {
      await sendMeetingConfirmation(adminEmail, { ...emailData, isAdmin: true });
    }
  } catch (emailErr) {
    console.error('Meeting confirmation email failed:', emailErr);
  }

  return NextResponse.json({
    success: true,
    meetingId: meeting?.id,
    calendarLink: calendarEvent?.htmlLink ?? null,
    meetLink: calendarEvent?.meetLink ?? null,
  });
}
