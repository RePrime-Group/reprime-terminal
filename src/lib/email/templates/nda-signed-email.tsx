import { Text } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface NdaSignedEmailProps {
  signerName: string;
  dateSigned: string;
}

export default function NdaSignedEmail({ signerName, dateSigned }: NdaSignedEmailProps) {
  return (
    <BaseLayout preview="Your signed RePrime confidentiality agreement">
      <Text style={headingStyle}>Your Signed Confidentiality Agreement</Text>

      <Text style={bodyStyle}>
        Hello{signerName ? ` ${signerName}` : ''},
      </Text>

      <Text style={bodyStyle}>
        Thank you for signing the RePrime confidentiality agreement on{' '}
        <strong style={{ color: '#0E3470' }}>{dateSigned}</strong>. A copy of the
        executed agreement is attached to this email as a PDF for your records.
      </Text>

      <Text style={bodyStyle}>
        Please retain this copy. If you have any questions about the agreement,
        contact us at the support address on our website.
      </Text>
    </BaseLayout>
  );
}

const headingStyle = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#0E3470',
  fontFamily: 'Georgia, serif',
  textAlign: 'center' as const,
  margin: '0 0 24px 0',
};

const bodyStyle = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#4B5563',
  margin: '0 0 16px 0',
};
