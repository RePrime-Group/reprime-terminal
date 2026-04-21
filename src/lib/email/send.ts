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
import DocumentUploadEmail from './templates/document-upload-notification';
import DealActivityEmail from './templates/deal-activity-notification';
import TeamInviteEmail from './templates/team-invite-email';
import TeamRequestAdminEmail from './templates/team-request-admin-email';
import PasswordResetEmail from './templates/password-reset-email';
import type { TeamPermissionKey } from '@/lib/types/database';

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
    subject: 'You\'ve been invited to RePrime Terminal Beta',
    react: InviteEmail({ inviteUrl, recipientEmail, inviteCode, expiresAt }),
  });
}

export async function sendPasswordResetEmail(
  recipientEmail: string,
  resetUrl: string,
  expiresInMinutes?: number,
) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: 'Reset your RePrime Terminal password',
    react: PasswordResetEmail({ resetUrl, recipientEmail, expiresInMinutes }),
  });
}

export async function sendWelcomeEmail(recipientEmail: string, firstName: string, portalUrl: string) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: `Welcome to RePrime Terminal Beta, ${firstName}`,
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
    subject: 'Application Received — RePrime Terminal Beta',
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
    subject: 'Update on Your Application — RePrime Terminal Beta',
    react: ApplicationRejectionEmail({ applicantName }),
  });
}

export async function sendCommitmentConfirmation(
  recipientEmail: string,
  data: {
    investorName: string;
    investorEmail?: string;
    investorPhone?: string;
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

export async function sendDocumentUploadEmail(
  recipientEmail: string,
  data: {
    dealName: string;
    city: string;
    state: string;
    docCount: number;
    firstDocName: string;
    portalUrl: string;
  },
) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: `New Documents: ${data.dealName} — ${data.city}, ${data.state}`,
    react: DocumentUploadEmail(data),
  });
}

export async function sendDealActivityEmail(
  recipientEmail: string,
  data: {
    dealName: string;
    city: string;
    state: string;
    changes: string[];
    portalUrl: string;
  },
) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: `Deal Update: ${data.dealName} — ${data.city}, ${data.state}`,
    react: DealActivityEmail(data),
  });
}

export async function sendTeamInviteEmail(
  recipientEmail: string,
  data: {
    parentName: string;
    inviteeName: string;
    inviteUrl: string;
    inviteCode?: string;
    expiresAt?: string;
  },
) {
  return getResend().emails.send({
    from,
    to: recipientEmail,
    subject: `${data.parentName} invited you to their RePrime team`,
    react: TeamInviteEmail(data),
  });
}

/**
 * Notify RePrime admins that an investor has submitted a team request
 * (either an invite-limit raise or a permission approval).
 */
export async function sendTeamRequestAdminNotification(data: {
  requestType: 'invite_limit' | 'permission';
  investorName: string;
  investorEmail: string;
  requestedTotal?: number;
  currentLimit?: number;
  targetName?: string;
  targetEmail?: string;
  permissionKey?: TeamPermissionKey;
  reason?: string | null;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reprimeterminal.com';
  const adminUrl = `${baseUrl}/en/admin/team-requests`;
  const subject =
    data.requestType === 'invite_limit'
      ? `Invite limit request: ${data.investorName}`
      : `Team permission request: ${data.investorName} → ${data.targetName ?? 'team member'}`;

  return getResend().emails.send({
    from,
    to: 'g@reprime.com',
    cc: ['steve@reprime.com', 'shirel@reprime.com'],
    subject,
    react: TeamRequestAdminEmail({
      ...data,
      adminUrl,
    }),
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
