import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface InviteEmailProps {
  inviteUrl: string;
  recipientEmail: string;
}

export default function InviteEmail({ inviteUrl, recipientEmail }: InviteEmailProps) {
  return (
    <BaseLayout preview="You've been selected for exclusive access to RePrime Terminal">
      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #BC9C45, #D4B96A)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '24px', color: '#FFFFFF', fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>R</span>
        </div>
      </Section>

      <Text style={headingStyle}>You&apos;ve Been Selected</Text>

      <Text style={bodyStyle}>
        You have been chosen for exclusive access to the <strong style={{ color: '#0E3470' }}>RePrime Terminal</strong> —
        a private platform for institutional-grade commercial real estate opportunities.
      </Text>

      <div style={dividerStyle} />

      <Text style={bodyStyle}>
        Your invitation has been sent to{' '}
        <strong style={{ color: '#0E3470' }}>{recipientEmail}</strong>.
        Click below to create your account and access the Terminal.
      </Text>

      <Section style={{ textAlign: 'center' as const, margin: '36px 0' }}>
        <Button style={goldButtonStyle} href={inviteUrl}>
          Accept Invitation
        </Button>
      </Section>

      <div style={infoBoxStyle}>
        <Text style={{ fontSize: '11px', color: '#6B7280', margin: 0, lineHeight: '18px' }}>
          <strong style={{ color: '#0E3470' }}>What you&apos;ll access:</strong><br />
          • Off-market CRE investment opportunities<br />
          • Complete due diligence data rooms<br />
          • Financial modeling & IRR calculators<br />
          • Direct scheduling with our acquisition team
        </Text>
      </div>

      <Text style={noteStyle}>
        This invitation is personal and non-transferable. It expires in 7 days.
      </Text>
    </BaseLayout>
  );
}

const headingStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#0E3470',
  margin: '0 0 16px 0',
  lineHeight: '34px',
  textAlign: 'center' as const,
  fontFamily: 'Georgia, serif',
};

const bodyStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#4B5563',
  lineHeight: '26px',
  margin: '0 0 16px 0',
};

const dividerStyle: React.CSSProperties = {
  height: '1px',
  background: 'linear-gradient(90deg, transparent, #BC9C45, transparent)',
  margin: '24px 0',
};

const goldButtonStyle: React.CSSProperties = {
  backgroundColor: '#BC9C45',
  color: '#FFFFFF',
  fontSize: '15px',
  fontWeight: 700,
  padding: '16px 48px',
  borderRadius: '12px',
  textDecoration: 'none',
  display: 'inline-block',
  boxShadow: '0 4px 16px rgba(188, 156, 69, 0.3)',
};

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: '#F7F8FA',
  borderRadius: '12px',
  padding: '20px',
  border: '1px solid #EEF0F4',
  margin: '24px 0',
};

const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9CA3AF',
  lineHeight: '18px',
  margin: '24px 0 0 0',
  textAlign: 'center' as const,
};
