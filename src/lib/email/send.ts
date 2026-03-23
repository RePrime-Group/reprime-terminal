import { getResend, FROM_EMAIL, FROM_NAME } from './resend';
import InviteEmail from './templates/invite-email';
import WelcomeEmail from './templates/welcome-email';
import DealNotificationEmail from './templates/deal-notification';
import MeetingConfirmation from './templates/meeting-confirmation';
import CommitmentConfirmation from './templates/commitment-confirmation';

const from = `${FROM_NAME} <${FROM_EMAIL}>`;

export async function sendInviteEmail(recipientEmail: string, inviteUrl: string) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: 'You\'ve been invited to RePrime Terminal',
    react: InviteEmail({ inviteUrl, recipientEmail }),
  });
}

export async function sendWelcomeEmail(recipientEmail: string, firstName: string, portalUrl: string) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: `Welcome to RePrime Terminal, ${firstName}`,
    react: WelcomeEmail({ firstName, portalUrl }),
  });
}

export async function sendDealNotificationEmail(
  recipientEmail: string,
  deal: { name: string; city: string; state: string; property_type: string; status: string },
  portalUrl: string,
) {
  const subject = deal.status === 'published'
    ? `New Deal: ${deal.name} — ${deal.city}, ${deal.state}`
    : `Update: ${deal.name}`;

  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject,
    react: DealNotificationEmail({
      dealName: deal.name,
      city: deal.city,
      state: deal.state,
      propertyType: deal.property_type,
      status: deal.status,
      portalUrl,
    }),
  });
}

export async function sendMeetingConfirmation(
  recipientEmail: string,
  data: {
    investorName: string;
    dealName: string;
    city: string;
    state: string;
    dateTime: string;
    calendarLink?: string;
    isAdmin?: boolean;
  },
) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: `Meeting Confirmed: ${data.dealName} — ${new Date(data.dateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    react: MeetingConfirmation(data),
  });
}

export async function sendCommitmentConfirmation(
  recipientEmail: string,
  data: {
    investorName: string;
    dealName: string;
    city: string;
    state: string;
    commitType: string;
    depositAmount?: string;
    portalUrl: string;
    isAdmin?: boolean;
  },
) {
  const type = data.commitType === 'primary' ? 'Committed' : 'Backup Position';
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: `${type}: ${data.dealName} — ${data.city}, ${data.state}`,
    react: CommitmentConfirmation(data),
  });
}
