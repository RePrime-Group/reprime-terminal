import { Text, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface ApplicationRejectionEmailProps {
  applicantName: string;
}

export default function ApplicationRejectionEmail({ applicantName }: ApplicationRejectionEmailProps) {
  const firstName = applicantName.split(' ')[0];

  return (
    <BaseLayout preview="Update on your RePrime Terminal membership application">
      <Section style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #BC9C45, #D4B96A)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '24px', color: '#FFFFFF', fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>R</span>
        </div>
      </Section>

      <Text style={headingStyle}>Application Update</Text>

      <Text style={bodyStyle}>
        Dear {firstName},
      </Text>

      <Text style={bodyStyle}>
        Thank you for your interest in the <strong style={{ color: '#0E3470' }}>RePrime Terminal</strong>.
        After careful review, we are unable to approve your membership application at this time.
      </Text>

      <div style={dividerStyle} />

      <Text style={bodyStyle}>
        This decision may be based on a number of factors, including current membership capacity
        and investor qualification requirements. It does not necessarily reflect on your credentials
        or investment profile.
      </Text>

      <div style={infoBoxStyle}>
        <Text style={{ fontSize: '13px', color: '#4B5563', margin: 0, lineHeight: '22px' }}>
          <strong style={{ color: '#0E3470' }}>What you can do:</strong><br />
          You are welcome to reapply in the future as new positions become available.
          If you believe this decision was made in error, or if your circumstances have changed,
          please reach out to our team directly.
        </Text>
      </div>

      <Text style={bodyStyle}>
        We appreciate your interest in RePrime and wish you continued success in your investment endeavors.
      </Text>

      <Text style={noteStyle}>
        This is an automated message. If you have questions, please contact our team at steve@reprime.com.
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
