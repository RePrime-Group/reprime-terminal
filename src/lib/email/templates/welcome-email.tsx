import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface WelcomeEmailProps {
  firstName: string;
  portalUrl: string;
}

export default function WelcomeEmail({ firstName, portalUrl }: WelcomeEmailProps) {
  return (
    <BaseLayout preview={`Welcome to RePrime Terminal, ${firstName} — your account is active`}>
      <Text style={headingStyle}>Welcome, {firstName}</Text>

      <Text style={bodyStyle}>
        Your RePrime Terminal account is now active. You have been granted access to our
        private platform for institutional-grade commercial real estate opportunities.
      </Text>

      <div style={dividerStyle} />

      <table cellPadding="0" cellSpacing="0" width="100%" style={{ borderCollapse: 'collapse', margin: '24px 0' }}>
        <tbody>
          {[
            { title: 'Active Deals', desc: 'Browse current off-market opportunities with full financial metrics' },
            { title: 'Data Rooms', desc: 'Access due diligence materials — financials, legal, environmental' },
            { title: 'Model Returns', desc: 'Interactive financial modeling with custom assumptions' },
            { title: 'Meet the Team', desc: 'Schedule calls directly with our acquisition team' },
          ].map((item, i) => (
            <tr key={i}>
              <td style={{ padding: '14px 0', borderBottom: i < 3 ? '1px solid #EEF0F4' : 'none', verticalAlign: 'top' }}>
                <table cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' }}>
                  <tr>
                    <td style={{ width: '48px', verticalAlign: 'top', paddingRight: '14px' }}>
                      <table cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' }}>
                        <tr>
                          <td style={numberBadgeStyle}>{i + 1}</td>
                        </tr>
                      </table>
                    </td>
                    <td>
                      <Text style={{ fontSize: '14px', fontWeight: 700, color: '#0E3470', margin: '0 0 2px 0' }}>{item.title}</Text>
                      <Text style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: '20px' }}>{item.desc}</Text>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <Button style={navyButtonStyle} href={portalUrl}>
          Enter Terminal
        </Button>
      </Section>

      <div style={infoBoxStyle}>
        <Text style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: '20px' }}>
          <strong style={{ color: '#BC9C45' }}>CONFIDENTIAL</strong> — All materials on the platform are
          proprietary. By accessing the Terminal, you agree to our terms of use and confidentiality provisions.
        </Text>
      </div>
    </BaseLayout>
  );
}

const headingStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#0E3470',
  margin: '0 0 16px 0',
  lineHeight: '34px',
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

const navyButtonStyle: React.CSSProperties = {
  backgroundColor: '#0E3470',
  color: '#FFFFFF',
  fontSize: '15px',
  fontWeight: 700,
  padding: '16px 48px',
  borderRadius: '12px',
  textDecoration: 'none',
  display: 'inline-block',
};

const numberBadgeStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, #BC9C45, #D4B96A)',
  color: '#FFFFFF',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: 'Georgia, serif',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  lineHeight: '36px',
};

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: '#FDF8ED',
  borderRadius: '12px',
  padding: '16px 20px',
  border: '1px solid #ECD9A0',
};
