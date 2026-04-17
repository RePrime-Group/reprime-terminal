import { Text, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface ApplicationAckEmailProps {
  applicantName: string;
}

export default function ApplicationAckEmail({ applicantName }: ApplicationAckEmailProps) {
  const firstName = applicantName.split(' ')[0];

  return (
    <BaseLayout preview="Your membership application has been received — RePrime Terminal Beta">
      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <table cellPadding="0" cellSpacing="0" align="center" style={{ margin: '0 auto 20px', borderCollapse: 'collapse' }}>
          <tr>
            <td style={badgeCellStyle}>
              <span style={{ fontSize: '24px', color: '#FFFFFF', fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>R</span>
            </td>
          </tr>
        </table>
      </Section>

      <Text style={headingStyle}>Application Received</Text>

      <Text style={bodyStyle}>
        Dear {firstName},
      </Text>

      <Text style={bodyStyle}>
        Thank you for your interest in the <strong style={{ color: '#0E3470' }}>RePrime Terminal Beta</strong>.
        We have received your membership application and our team is reviewing it.
      </Text>

      <div style={dividerStyle} />

      <div style={infoBoxStyle}>
        <Text style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 12px 0', lineHeight: '18px' }}>
          <strong style={{ color: '#0E3470' }}>What happens next:</strong>
        </Text>
        <Text style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 6px 0', lineHeight: '22px' }}>
          1. Our team reviews your application within <strong>48 hours</strong>
        </Text>
        <Text style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 6px 0', lineHeight: '22px' }}>
          2. You&apos;ll receive an invitation link via email once approved
        </Text>
        <Text style={{ fontSize: '13px', color: '#4B5563', margin: '0', lineHeight: '22px' }}>
          3. Create your account and access the Terminal
        </Text>
      </div>

      <Text style={bodyStyle}>
        If you have any questions in the meantime, please don&apos;t hesitate to reach out to our team.
      </Text>

      <Text style={noteStyle}>
        This is an automated confirmation. You do not need to reply to this email.
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

const badgeCellStyle: React.CSSProperties = {
  width: '56px',
  height: '56px',
  borderRadius: '28px',
  background: 'linear-gradient(135deg, #BC9C45, #D4B96A)',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  lineHeight: '56px',
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
