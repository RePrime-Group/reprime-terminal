import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface ApplicationNotifyEmailProps {
  applicantName: string;
  applicantEmail: string;
  companyName?: string | null;
  phone?: string | null;
  adminUrl: string;
}

export default function ApplicationNotifyEmail({
  applicantName,
  applicantEmail,
  companyName,
  phone,
  adminUrl,
}: ApplicationNotifyEmailProps) {
  return (
    <BaseLayout preview={`New membership application from ${applicantName}`}>
      <Text style={headingStyle}>New Membership Application</Text>

      <Text style={bodyStyle}>
        A new membership application has been submitted and is awaiting review.
      </Text>

      <div style={dividerStyle} />

      <div style={detailBoxStyle}>
        <table cellPadding="0" cellSpacing="0" width="100%" style={{ borderCollapse: 'collapse' }}>
          <tr>
            <td style={labelStyle}>Name</td>
            <td style={valueStyle}>{applicantName}</td>
          </tr>
          <tr>
            <td style={labelStyle}>Email</td>
            <td style={valueStyle}>
              <a href={`mailto:${applicantEmail}`} style={{ color: '#BC9C45', textDecoration: 'none' }}>
                {applicantEmail}
              </a>
            </td>
          </tr>
          {companyName && (
            <tr>
              <td style={labelStyle}>Company</td>
              <td style={valueStyle}>{companyName}</td>
            </tr>
          )}
          {phone && (
            <tr>
              <td style={labelStyle}>Phone</td>
              <td style={valueStyle}>{phone}</td>
            </tr>
          )}
        </table>
      </div>

      <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <Button style={goldButtonStyle} href={adminUrl}>
          Review Application
        </Button>
      </Section>

      <Text style={noteStyle}>
        This application requires action. Please review and approve or reject within 48 hours.
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

const detailBoxStyle: React.CSSProperties = {
  backgroundColor: '#F0F4FF',
  borderRadius: '12px',
  padding: '20px 24px',
  border: '1px solid #E0E7F1',
  margin: '24px 0',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#6B7280',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  padding: '8px 16px 8px 0',
  verticalAlign: 'top',
  width: '80px',
};

const valueStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#0E3470',
  fontWeight: 500,
  padding: '8px 0',
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

const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9CA3AF',
  lineHeight: '18px',
  margin: '24px 0 0 0',
  textAlign: 'center' as const,
};
