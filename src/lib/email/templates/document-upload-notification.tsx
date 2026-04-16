import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface DocumentUploadEmailProps {
  dealName: string;
  city: string;
  state: string;
  docCount: number;
  firstDocName: string;
  portalUrl: string;
}

export default function DocumentUploadEmail({
  dealName,
  city,
  state,
  docCount,
  firstDocName,
  portalUrl,
}: DocumentUploadEmailProps) {
  const tag = 'NEW DOCUMENTS';
  const tagColor = '#0E3470';
  const description =
    docCount === 1
      ? `A new document has been uploaded to the data room for ${dealName}: ${firstDocName}.`
      : `${docCount} new documents have been uploaded to the data room for ${dealName}, starting with ${firstDocName}.`;

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

      <Text style={bodyStyle}>{description}</Text>

      <Section style={{ textAlign: 'center' as const, margin: '36px 0' }}>
        <Button style={navyButtonStyle} href={portalUrl}>
          Open Data Room
        </Button>
      </Section>

      <Text style={noteStyle}>
        This notification was sent because you have access to this deal&apos;s data room.
        You can manage notifications in your Terminal settings.
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
