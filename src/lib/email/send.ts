import { getResend, FROM_EMAIL, FROM_NAME } from './resend';
import InviteEmail from './templates/invite-email';
import WelcomeEmail from './templates/welcome-email';
import DealNotificationEmail from './templates/deal-notification';
import MeetingConfirmation from './templates/meeting-confirmation';
import CommitmentConfirmation from './templates/commitment-confirmation';
import ApplicationAckEmail from './templates/application-ack-email';
import ApplicationNotifyEmail from './templates/application-notify-email';
import ApplicationRejectionEmail from './templates/application-rejection-email';
import CommitmentWithdrawal from './templates/commitment-withdrawal';

const from = `${FROM_NAME} <${FROM_EMAIL}>`;

export async function sendInviteEmail(
  recipientEmail: string,
  inviteUrl: string,
  inviteCode?: string,
  expiresAt?: string,
) {

  console.error("from", from)
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: 'You\'ve been invited to RePrime Terminal',
    react: InviteEmail({ inviteUrl, recipientEmail, inviteCode, expiresAt }),
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

export async function sendApplicationAckEmail(recipientEmail: string, applicantName: string) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: 'Application Received — RePrime Terminal',
    react: ApplicationAckEmail({ applicantName }),
  });
}

export async function sendApplicationNotifyEmail(
  applicant: { full_name: string; email: string; company_name?: string | null; phone?: string | null },
  origin: string,
) {
  const adminUrl = `${origin}/en/admin/applications`;
  return getResend().emails.send({
    from,
    to: 'g@reprime.com',
    cc: ['steve@reprime.com', 'shirel@reprime.com'],
    subject: `New Membership Application: ${applicant.full_name}`,
    react: ApplicationNotifyEmail({
      applicantName: applicant.full_name,
      applicantEmail: applicant.email,
      companyName: applicant.company_name,
      phone: applicant.phone,
      adminUrl,
    }),
  });
}

export async function sendApplicationRejectionEmail(recipientEmail: string, applicantName: string) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: 'Update on Your Application — RePrime Terminal',
    react: ApplicationRejectionEmail({ applicantName }),
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
  },
  cc?: string[],
) {
  const type = data.commitType === 'primary' ? 'Committed' : 'Backup Position';
  return getResend().emails.send({
    from,
    to: recipientEmail,
    ...(cc && cc.length > 0 ? { cc } : {}),
    subject: `${type}: ${data.dealName} — ${data.city}, ${data.state}`,
    react: CommitmentConfirmation(data),
  });
}

export async function sendCommitmentWithdrawal(
  recipientEmail: string,
  data: {
    investorName: string;
    dealName: string;
    city: string;
    state: string;
    portalUrl: string;
  },
  cc?: string[],
) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    ...(cc && cc.length > 0 ? { cc } : {}),
    subject: `Commitment Withdrawn: ${data.dealName} — ${data.city}, ${data.state}`,
    react: CommitmentWithdrawal(data),
  });
}
