import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface MeetingConfirmationProps {
  investorName: string;
  dealName: string;
  city: string;
  state: string;
  dateTime: string;
  calendarLink?: string;
  isAdmin?: boolean;
}

export default function MeetingConfirmation({
  investorName,
  dealName,
  city,
  state,
  dateTime,
  calendarLink,
  isAdmin = false,
}: MeetingConfirmationProps) {
  const formattedDate = new Date(dateTime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = new Date(dateTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <BaseLayout preview={`Meeting confirmed: ${dealName} — ${formattedDate} at ${formattedTime}`}>
      <div style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%',
          backgroundColor: '#ECFDF5', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '24px' }}>📅</span>
        </div>
      </div>

      <Text style={headingStyle}>Meeting Confirmed</Text>

      <Text style={bodyStyle}>
        {isAdmin
          ? `${investorName} has scheduled a meeting to discuss ${dealName}.`
          : `Your meeting has been confirmed. We look forward to discussing ${dealName} with you.`
        }
      </Text>

      <div style={meetingCardStyle}>
        <table cellPadding="0" cellSpacing="0" width="100%" style={{ borderCollapse: 'collapse' }}>
          <tr>
            <td style={{ padding: '14px 0', borderBottom: '1px solid #EEF0F4' }}>
              <Text style={labelStyle}>DEAL</Text>
              <Text style={valueStyle}>{dealName} — {city}, {state}</Text>
            </td>
          </tr>
          <tr>
            <td style={{ padding: '14px 0', borderBottom: '1px solid #EEF0F4' }}>
              <Text style={labelStyle}>DATE</Text>
              <Text style={valueStyle}>{formattedDate}</Text>
            </td>
          </tr>
          <tr>
            <td style={{ padding: '14px 0', borderBottom: '1px solid #EEF0F4' }}>
              <Text style={labelStyle}>TIME</Text>
              <Text style={valueStyle}>{formattedTime}</Text>
            </td>
          </tr>
          <tr>
            <td style={{ padding: '14px 0' }}>
              <Text style={labelStyle}>DURATION</Text>
              <Text style={valueStyle}>30 minutes</Text>
            </td>
          </tr>
        </table>
      </div>

      {calendarLink && (
        <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
          <Button style={navyButtonStyle} href={calendarLink}>
            Add to Calendar
          </Button>
        </Section>
      )}

      <div style={infoBoxStyle}>
        <Text style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: '20px' }}>
          Need to reschedule? Contact us via{' '}
          <a href="https://wa.me/19177030365" style={{ color: '#BC9C45', textDecoration: 'none' }}>WhatsApp</a>{' '}
          or reply to this email.
        </Text>
      </div>
    </BaseLayout>
  );
}

const headingStyle: React.CSSProperties = {
  fontSize: '26px', fontWeight: 700, color: '#0E3470',
  margin: '0 0 16px 0', lineHeight: '32px', textAlign: 'center' as const,
  fontFamily: 'Georgia, serif',
};

const bodyStyle: React.CSSProperties = {
  fontSize: '15px', color: '#4B5563', lineHeight: '26px', margin: '0 0 24px 0',
};

const meetingCardStyle: React.CSSProperties = {
  backgroundColor: '#F7F8FA', borderRadius: '14px', padding: '8px 24px',
  border: '1px solid #EEF0F4',
};

const labelStyle: React.CSSProperties = {
  fontSize: '9px', fontWeight: 700, letterSpacing: '2px', color: '#9CA3AF',
  margin: '0 0 4px 0',
};

const valueStyle: React.CSSProperties = {
  fontSize: '15px', fontWeight: 600, color: '#0E3470', margin: 0,
};

const navyButtonStyle: React.CSSProperties = {
  backgroundColor: '#0E3470', color: '#FFFFFF', fontSize: '14px', fontWeight: 700,
  padding: '14px 40px', borderRadius: '12px', textDecoration: 'none', display: 'inline-block',
};

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: '#FDF8ED', borderRadius: '10px', padding: '14px 18px',
  border: '1px solid #ECD9A0',
};
