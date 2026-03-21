import { getResend, FROM_EMAIL, FROM_NAME } from './resend';
import InviteEmail from './templates/invite-email';
import WelcomeEmail from './templates/welcome-email';
import DealNotificationEmail from './templates/deal-notification';

export async function sendInviteEmail(recipientEmail: string, inviteUrl: string) {
  return getResend().emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: recipientEmail,
    subject: 'You\'ve been invited to RePrime Terminal',
    react: InviteEmail({ inviteUrl, recipientEmail }),
  });
}

export async function sendWelcomeEmail(recipientEmail: string, firstName: string, portalUrl: string) {
  return getResend().emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
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
    : `Update: ${deal.name} — LOI Signed`;

  return getResend().emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
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
