import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface CriteriaFormEmailProps {
  formUrl: string;
  recipientName: string;
}

export default function CriteriaFormEmail({ formUrl, recipientName }: CriteriaFormEmailProps) {
  const firstName = (recipientName ?? '').split(' ')[0] || 'there';
  const preheader = 'Tell us what you’re buying — a quick form so we can send you the right deals.';

  return (
    <BaseLayout preview={preheader}>
      <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
        <table cellPadding="0" cellSpacing="0" align="center" style={{ margin: '0 auto 20px', borderCollapse: 'collapse' }}>
          <tr>
            <td style={badgeCellStyle}>
              <span style={{ fontSize: '24px', color: '#FFFFFF', fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>R</span>
            </td>
          </tr>
        </table>
      </Section>

      <Text style={headingStyle}>Tell us what you’re buying</Text>

      <Text style={bodyStyle}>
        Hi {firstName} — we’d like to make sure we’re only sending you deals that
        actually fit. The form below takes about 90 seconds.
      </Text>

      <Text style={bodyStyle}>
        Please indicate your target property types, markets, price range, and
        any deal structures you are open to. If you pursue more than one
        investment strategy, you may submit additional mandates within the
        same form.
      </Text>

      <div style={dividerStyle} />

      <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <Button style={goldButtonStyle} href={formUrl}>
          Open the form
        </Button>
      </Section>

      <Text style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '18px', margin: '0 0 8px 0', textAlign: 'center' as const }}>
        Or copy and paste this link into your browser:
      </Text>
      <Text style={{ fontSize: '12px', color: '#BC9C45', lineHeight: '18px', margin: '0 0 16px 0', textAlign: 'center' as const, wordBreak: 'break-all' as const }}>
        <a href={formUrl} style={{ color: '#BC9C45', textDecoration: 'underline' }}>{formUrl}</a>
      </Text>

      <div style={noticeBoxStyle}>
        <Text style={{ fontSize: '12px', color: '#92400E', margin: 0, lineHeight: '18px' }}>
          <strong>This link is single-use.</strong> Once you submit, it expires.
          If you ever want to update your criteria later, ping your RePrime
          relationship lead and we’ll send you a fresh one.
        </Text>
      </div>

      <Text style={noteStyle}>
        This link is personal to you. Please don’t forward it.
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

const noticeBoxStyle: React.CSSProperties = {
  backgroundColor: '#FFFBEB',
  borderRadius: '8px',
  padding: '12px 16px',
  border: '1px solid #FDE68A',
  margin: '16px 0',
};

const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9CA3AF',
  lineHeight: '18px',
  margin: '24px 0 0 0',
  textAlign: 'center' as const,
};
