import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface TeamInviteEmailProps {
  parentName: string;
  inviteeName: string;
  inviteUrl: string;
  inviteCode?: string;
  expiresAt?: string;
}

export default function TeamInviteEmail({
  parentName,
  inviteeName,
  inviteUrl,
  inviteCode,
  expiresAt,
}: TeamInviteEmailProps) {
  const expiryDisplay = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '30 days from now';

  return (
    <BaseLayout preview={`${parentName} invited you to join their RePrime team`}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <table cellPadding="0" cellSpacing="0" align="center" style={{ margin: '0 auto 20px', borderCollapse: 'collapse' }}>
          <tr>
            <td style={badgeCellStyle}>
              <span style={{ fontSize: '24px', color: '#FFFFFF', fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>R</span>
            </td>
          </tr>
        </table>
      </Section>

      <Text style={headingStyle}>You&apos;ve Been Added to a Team</Text>

      <Text style={bodyStyle}>
        Hi {inviteeName},
      </Text>

      <Text style={bodyStyle}>
        <strong style={{ color: '#0E3470' }}>{parentName}</strong> has invited you to their RePrime
        Terminal Beta team — a private platform for institutional-grade commercial real estate
        opportunities.
      </Text>

      <div style={dividerStyle} />

      <Text style={bodyStyle}>
        Click below to create your account. {parentName} controls what actions you can perform on
        their behalf and can adjust those permissions at any time.
      </Text>

      <Section style={{ textAlign: 'center' as const, margin: '36px 0' }}>
        <Button style={goldButtonStyle} href={inviteUrl}>
          Accept Invitation
        </Button>
      </Section>

      <Text style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '18px', margin: '0 0 8px 0', textAlign: 'center' as const }}>
        Or copy and paste this link into your browser:
      </Text>
      <Text style={{ fontSize: '12px', color: '#BC9C45', lineHeight: '18px', margin: '0 0 16px 0', textAlign: 'center' as const, wordBreak: 'break-all' as const }}>
        <a href={inviteUrl} style={{ color: '#BC9C45', textDecoration: 'underline' }}>{inviteUrl}</a>
      </Text>

      {inviteCode && (
        <div style={codeBoxStyle}>
          <Text style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 8px 0', textTransform: 'uppercase' as const, letterSpacing: '1px', fontWeight: 600 }}>
            Your Invite Code
          </Text>
          <Text style={{ fontSize: '18px', color: '#0E3470', margin: 0, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '2px', wordBreak: 'break-all' as const }}>
            {inviteCode}
          </Text>
        </div>
      )}

      <div style={expiryBoxStyle}>
        <Text style={{ fontSize: '12px', color: '#92400E', margin: 0, lineHeight: '18px' }}>
          <strong>Expires:</strong> {expiryDisplay}
        </Text>
      </div>

      <Text style={noteStyle}>
        This invitation is personal and non-transferable. Do not share this link or code with others.
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
const badgeCellStyle: React.CSSProperties = {
  width: '56px',
  height: '56px',
  borderRadius: '28px',
  background: 'linear-gradient(135deg, #BC9C45, #D4B96A)',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  lineHeight: '56px',
};
const codeBoxStyle: React.CSSProperties = {
  backgroundColor: '#FDF8ED',
  borderRadius: '12px',
  padding: '20px',
  border: '1px dashed #BC9C45',
  margin: '24px 0',
  textAlign: 'center' as const,
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
