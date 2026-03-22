import { google } from 'googleapis';

function getAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  const parsed = JSON.parse(credentials);

  return new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

function getCalendar() {
  const auth = getAuth();
  return google.calendar({ version: 'v3', auth });
}

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

/**
 * Get busy times from Google Calendar for a date range.
 * Returns an array of { start, end } ISO strings.
 */
export async function getBusyTimes(
  startDate: string,
  endDate: string
): Promise<{ start: string; end: string }[]> {
  const calendar = getCalendar();

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: startDate,
      timeMax: endDate,
      items: [{ id: CALENDAR_ID }],
    },
  });

  const busy = res.data.calendars?.[CALENDAR_ID]?.busy ?? [];
  return busy.map((b) => ({
    start: b.start ?? '',
    end: b.end ?? '',
  }));
}

/**
 * Create a calendar event and send invites.
 */
export async function createCalendarEvent({
  summary,
  description,
  startTime,
  endTime,
  attendeeEmails,
  location,
}: {
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendeeEmails: string[];
  location?: string;
}): Promise<{ eventId: string; htmlLink: string }> {
  const calendar = getCalendar();

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    sendUpdates: 'all', // sends calendar invite emails
    requestBody: {
      summary,
      description,
      location,
      start: {
        dateTime: startTime,
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: endTime,
        timeZone: 'America/New_York',
      },
      attendees: attendeeEmails.map((email) => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
      conferenceData: {
        createRequest: {
          requestId: `reprime-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
    conferenceDataVersion: 1,
  });

  return {
    eventId: event.data.id ?? '',
    htmlLink: event.data.htmlLink ?? '',
  };
}
