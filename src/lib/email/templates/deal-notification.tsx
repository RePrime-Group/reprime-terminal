import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface DealNotificationEmailProps {
  dealName: string;
  city: string;
  state: string;
  propertyType: string;
  status: string;
  portalUrl: string;
}

export default function DealNotificationEmail({
  dealName,
  city,
  state,
  propertyType,
  status,
  portalUrl,
}: DealNotificationEmailProps) {
  const isNew = status === 'published';
  const isLoi = status === 'loi_signed';
  const isComingSoon = status === 'coming_soon';

  const tag = isNew ? 'NEW DEAL AVAILABLE' : isLoi ? 'LOI SIGNED' : isComingSoon ? 'COMING SOON' : 'DEAL UPDATE';
  const tagColor = isNew ? '#0B8A4D' : isLoi ? '#BC9C45' : '#0E3470';

  const description = isNew
    ? 'A new investment opportunity has been published to the Terminal. Full financial metrics, due diligence materials, and modeling tools are now available.'
    : isLoi
      ? 'The Letter of Intent has been executed. The Purchase and Sales Agreement is being drafted — the 7-day countdown to DD has begun.'
      : isComingSoon
        ? 'A new opportunity is in the pipeline. We are in advanced negotiations and expect to sign the LOI shortly.'
        : 'There has been an update to a deal on the Terminal.';

  return (
    <BaseLayout preview={`${tag}: ${dealName} — ${city}, ${state}`}>
      {/* Tag */}
      <div style={{ display: 'inline-block', backgroundColor: `${tagColor}15`, borderRadius: '6px', padding: '6px 14px', marginBottom: '20px' }}>
        <Text style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', color: tagColor, margin: 0 }}>
          {tag}
        </Text>
      </div>

      <Text style={dealNameStyle}>{dealName}</Text>

      <Text style={dealMetaStyle}>
        {city}, {state} &middot; {propertyType}
      </Text>

      <div style={dividerStyle} />

      <Text style={bodyStyle}>{description}</Text>

      <Section style={{ textAlign: 'center' as const, margin: '36px 0' }}>
        <Button style={navyButtonStyle} href={portalUrl}>
          View Deal
        </Button>
      </Section>

      <Text style={noteStyle}>
        This notification was sent because you are a member of RePrime Terminal.
        You can manage your notification preferences in the Terminal settings.
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
