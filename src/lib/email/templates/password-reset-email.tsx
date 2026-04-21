import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface PasswordResetEmailProps {
  resetUrl: string;
  recipientEmail: string;
  expiresInMinutes?: number;
}

export default function PasswordResetEmail({
  resetUrl,
  recipientEmail,
  expiresInMinutes = 60,
}: PasswordResetEmailProps) {
  return (
    <BaseLayout preview="Reset your RePrime Terminal password">
      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <table cellPadding="0" cellSpacing="0" align="center" style={{ margin: '0 auto 20px', borderCollapse: 'collapse' }}>
          <tr>
            <td style={badgeCellStyle}>
              <span style={{ fontSize: '24px', color: '#FFFFFF', fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>R</span>
            </td>
          </tr>
        </table>
      </Section>

      <Text style={headingStyle}>Reset Your Password</Text>

      <Text style={bodyStyle}>
        We received a request to reset the password for{' '}
        <strong style={{ color: '#0E3470' }}>{recipientEmail}</strong>.
        Click the button below to choose a new password.
      </Text>

      <Section style={{ textAlign: 'center' as const, margin: '36px 0' }}>
        <Button style={goldButtonStyle} href={resetUrl}>
          Reset Password
        </Button>
      </Section>

      <Text style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '18px', margin: '0 0 8px 0', textAlign: 'center' as const }}>
        Or copy and paste this link into your browser:
      </Text>
      <Text style={{ fontSize: '12px', color: '#BC9C45', lineHeight: '18px', margin: '0 0 16px 0', textAlign: 'center' as const, wordBreak: 'break-all' as const }}>
        <a href={resetUrl} style={{ color: '#BC9C45', textDecoration: 'underline' }}>{resetUrl}</a>
      </Text>

      <div style={expiryBoxStyle}>
        <Text style={{ fontSize: '12px', color: '#92400E', margin: 0, lineHeight: '18px' }}>
          <strong>This link expires in {expiresInMinutes} minutes.</strong>
        </Text>
      </div>

      <Text style={noteStyle}>
        If you didn&rsquo;t request a password reset, you can safely ignore this email — your password will remain unchanged.
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

const badgeCellStyle: React.CSSProperties = {
  width: '56px',
  height: '56px',
  borderRadius: '28px',
  background: 'linear-gradient(135deg, #BC9C45, #D4B96A)',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  lineHeight: '56px',
};

const expiryBoxStyle: React.CSSProperties = {
  backgroundColor: '#FFFBEB',
  borderRadius: '8px',
  padding: '12px 16px',
  border: '1px solid #FDE68A',
  margin: '16px 0',
  textAlign: 'center' as const,
};

const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9CA3AF',
  lineHeight: '18px',
  margin: '24px 0 0 0',
  textAlign: 'center' as const,
};
