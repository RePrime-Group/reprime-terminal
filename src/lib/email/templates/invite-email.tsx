import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface InviteEmailProps {
  inviteUrl: string;
  recipientEmail: string;
}

export default function InviteEmail({ inviteUrl, recipientEmail }: InviteEmailProps) {
  return (
    <BaseLayout preview="You've been invited to RePrime Terminal — exclusive CRE investment access">
      <Text style={greetingStyle}>
        You&apos;ve been invited
      </Text>

      <Text style={bodyTextStyle}>
        You have been selected for exclusive access to the RePrime Terminal — a
        private platform for institutional-grade commercial real estate
        opportunities.
      </Text>

      <Text style={bodyTextStyle}>
        Your invitation has been sent to{' '}
        <strong style={{ color: '#0E3470' }}>{recipientEmail}</strong>.
      </Text>

      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button style={ctaButtonStyle} href={inviteUrl}>
          Accept Invitation
        </Button>
      </Section>

      <Text style={noteStyle}>
        This invitation is personal and non-transferable. If you did not expect
        this invitation, please disregard this email.
      </Text>
    </BaseLayout>
  );
}

const greetingStyle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 600,
  color: '#0E3470',
  margin: '0 0 16px 0',
  lineHeight: '32px',
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#4B5563',
  lineHeight: '24px',
  margin: '0 0 12px 0',
};

const ctaButtonStyle: React.CSSProperties = {
  backgroundColor: '#BC9C45',
  color: '#FFFFFF',
  fontSize: '14px',
  fontWeight: 600,
  padding: '14px 36px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'inline-block',
};

const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9CA3AF',
  lineHeight: '18px',
  margin: '24px 0 0 0',
  borderTop: '1px solid #EEF0F4',
  paddingTop: '16px',
};
