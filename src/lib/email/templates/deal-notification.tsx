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
  const isNewDeal = status === 'published';
  const isLoiSigned = status === 'loi_signed';

  const headline = isNewDeal
    ? 'New Deal Available'
    : isLoiSigned
      ? 'LOI Signed — PSA In Progress'
      : 'Deal Status Update';

  const description = isNewDeal
    ? 'A new investment opportunity has been published to the Terminal. Full due diligence materials and financial metrics are now available.'
    : isLoiSigned
      ? 'The Letter of Intent has been executed for this property. The Purchase and Sales Agreement is now being drafted.'
      : 'There has been an update to a deal you are following.';

  return (
    <BaseLayout preview={`${headline}: ${dealName} — ${city}, ${state}`}>
      <Text style={tagStyle}>
        {headline.toUpperCase()}
      </Text>

      <Text style={dealNameStyle}>
        {dealName}
      </Text>

      <Text style={dealMetaStyle}>
        {city}, {state} &middot; {propertyType}
      </Text>

      <Text style={bodyTextStyle}>
        {description}
      </Text>

      <Section style={{ textAlign: 'center', margin: '32px 0' }}>
        <Button style={ctaButtonStyle} href={portalUrl}>
          View Deal
        </Button>
      </Section>

      <Text style={noteStyle}>
        This notification was sent because you are a member of RePrime Terminal
        or subscribed to updates for this property.
      </Text>
    </BaseLayout>
  );
}

const tagStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '2px',
  color: '#BC9C45',
  margin: '0 0 8px 0',
};

const dealNameStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 600,
  color: '#0E3470',
  margin: '0 0 4px 0',
  lineHeight: '36px',
};

const dealMetaStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#6B7280',
  margin: '0 0 20px 0',
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#4B5563',
  lineHeight: '24px',
  margin: '0 0 12px 0',
};

const ctaButtonStyle: React.CSSProperties = {
  backgroundColor: '#0E3470',
  color: '#FFFFFF',
  fontSize: '14px',
  fontWeight: 600,
  padding: '14px 36px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'inline-block',
};

const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9CA3AF',
  lineHeight: '18px',
  margin: '24px 0 0 0',
  borderTop: '1px solid #EEF0F4',
  paddingTop: '16px',
};
