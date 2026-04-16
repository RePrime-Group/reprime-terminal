import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface DealActivityEmailProps {
  dealName: string;
  city: string;
  state: string;
  changes: string[];
  portalUrl: string;
}

export default function DealActivityEmail({
  dealName,
  city,
  state,
  changes,
  portalUrl,
}: DealActivityEmailProps) {
  const tag = 'DEAL UPDATE';
  const tagColor = '#BC9C45';

  return (
    <BaseLayout preview={`${tag}: ${dealName} — ${city}, ${state}`}>
      <div style={{ display: 'inline-block', backgroundColor: `${tagColor}15`, borderRadius: '6px', padding: '6px 14px', marginBottom: '20px' }}>
        <Text style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', color: tagColor, margin: 0 }}>
          {tag}
        </Text>
      </div>

      <Text style={dealNameStyle}>{dealName}</Text>

      <Text style={dealMetaStyle}>
        {city}, {state}
      </Text>

      <div style={dividerStyle} />

      <Text style={bodyStyle}>
        The following information {changes.length === 1 ? 'was' : 'were'} updated on this deal:
      </Text>

      <table cellPadding="0" cellSpacing="0" width="100%" style={changesTableStyle}>
        <tbody>
          {changes.map((c) => (
            <tr key={c}>
              <td style={bulletCellStyle}>
                <span style={bulletDotStyle} />
              </td>
              <td style={bulletLabelStyle}>{c}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section style={{ textAlign: 'center' as const, margin: '36px 0' }}>
        <Button style={navyButtonStyle} href={portalUrl}>
          Review Changes
        </Button>
      </Section>

      <Text style={noteStyle}>
        You&apos;re receiving this because you&apos;ve committed to or watchlisted this deal.
        Manage notifications in your Terminal settings.
      </Text>
    </BaseLayout>
  );
}

const dealNameStyle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: 700,
  color: '#0E3470',
  margin: '0 0 6px 0',
  lineHeight: '38px',
  fontFamily: 'Georgia, serif',
};

const dealMetaStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#6B7280',
  margin: '0 0 4px 0',
};

const dividerStyle: React.CSSProperties = {
  height: '1px',
  background: 'linear-gradient(90deg, transparent, #BC9C45, transparent)',
  margin: '24px 0',
};

const bodyStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#4B5563',
  lineHeight: '26px',
  margin: '0 0 12px 0',
};

const changesTableStyle: React.CSSProperties = {
  borderCollapse: 'collapse',
  margin: '4px 0 12px 0',
};

const bulletCellStyle: React.CSSProperties = {
  width: '18px',
  verticalAlign: 'middle',
  textAlign: 'center' as const,
  paddingRight: '6px',
};

const bulletDotStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '6px',
  height: '6px',
  borderRadius: '3px',
  backgroundColor: '#BC9C45',
  verticalAlign: 'middle',
};

const bulletLabelStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#0E3470',
  lineHeight: '26px',
  fontWeight: 600,
  verticalAlign: 'middle',
  paddingTop: '3px',
  paddingBottom: '3px',
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

const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9CA3AF',
  lineHeight: '18px',
  margin: '24px 0 0 0',
  textAlign: 'center' as const,
};
