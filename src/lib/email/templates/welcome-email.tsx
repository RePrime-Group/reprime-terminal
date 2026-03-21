import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface WelcomeEmailProps {
  firstName: string;
  portalUrl: string;
}

export default function WelcomeEmail({ firstName, portalUrl }: WelcomeEmailProps) {
  return (
    <BaseLayout preview={`Welcome to RePrime Terminal, ${firstName}`}>
      <Text style={greetingStyle}>
        Welcome, {firstName}
      </Text>

      <Text style={bodyTextStyle}>
        Your RePrime Terminal account is now active. You now have access to
        institutional-grade CRE investment opportunities, comprehensive due
        diligence materials, and direct scheduling with our acquisition team.
      </Text>

      <Text style={bodyTextStyle}>
        Here&apos;s what you can do:
      </Text>

      <ul style={listStyle}>
        <li style={listItemStyle}>Browse active and upcoming deals</li>
        <li style={listItemStyle}>Access full due diligence data rooms</li>
        <li style={listItemStyle}>Model returns with our IRR calculator</li>
        <li style={listItemStyle}>Schedule meetings directly with the team</li>
      </ul>

      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button style={ctaButtonStyle} href={portalUrl}>
          Enter Terminal
        </Button>
      </Section>

      <Text style={noteStyle}>
        All materials on the platform are confidential. By accessing the
        Terminal, you agree to our terms of use and confidentiality provisions.
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

const listStyle: React.CSSProperties = {
  paddingLeft: '20px',
  margin: '0 0 12px 0',
};

const listItemStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#4B5563',
  lineHeight: '28px',
};

const ctaButtonStyle: React.CSSProperties = {
  backgroundColor: '#0E3470',
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
