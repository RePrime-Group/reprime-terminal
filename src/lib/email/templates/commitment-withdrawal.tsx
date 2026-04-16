import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface CommitmentWithdrawalProps {
  investorName: string;
  dealName: string;
  city: string;
  state: string;
  portalUrl: string;
  isAdmin?: boolean;
}

export default function CommitmentWithdrawal({
  investorName,
  dealName,
  city,
  state,
  portalUrl,
  isAdmin = false,
}: CommitmentWithdrawalProps) {
  return (
    <BaseLayout preview={`Commitment Withdrawn: ${dealName}`}>
      <div style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
        <table cellPadding="0" cellSpacing="0" align="center" style={{ margin: '0 auto 16px', borderCollapse: 'collapse' }}>
          <tr>
            <td style={badgeCellStyle}>
              <span style={{ fontSize: '22px', color: '#9CA3AF' }}>✕</span>
            </td>
          </tr>
        </table>
      </div>

      <Text style={headingStyle}>
        {isAdmin ? 'Commitment Withdrawn' : 'Commitment Withdrawn'}
      </Text>

      <Text style={bodyStyle}>
        {isAdmin
          ? `${investorName} has withdrawn their commitment for the following deal.`
          : 'Your commitment has been withdrawn. You are no longer registered as a buyer for this deal.'
        }
      </Text>

      <div style={dealCardStyle}>
        <div style={{ padding: '24px' }}>
          <Text style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', color: '#9CA3AF', margin: '0 0 8px 0' }}>
            WITHDRAWN
          </Text>
          <Text style={{ fontSize: '24px', fontWeight: 700, color: '#0E3470', margin: '0 0 4px 0', fontFamily: 'Georgia, serif' }}>
            {dealName}
          </Text>
          <Text style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            {city}, {state}
          </Text>
        </div>
      </div>

      {!isAdmin && (
        <>
          <div style={infoBoxStyle}>
            <Text style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: '20px' }}>
              If this was a mistake, you can re-commit at any time from the deal page.
              Your position is no longer reserved and may be taken by another investor.
            </Text>
          </div>

          <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
            <Button style={goldButtonStyle} href={portalUrl}>
              View Deal
            </Button>
          </Section>
        </>
      )}

      <Text style={noteStyle}>
        Questions? Contact us via{' '}
        <a href="https://wa.me/19177030365" style={{ color: '#BC9C45', textDecoration: 'none' }}>WhatsApp</a>{' '}
        or reply to this email.
      </Text>
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

const badgeCellStyle: React.CSSProperties = {
  width: '52px',
  height: '52px',
  borderRadius: '26px',
  backgroundColor: '#F7F8FA',
  border: '2px solid #EEF0F4',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  lineHeight: '48px',
};

const dealCardStyle: React.CSSProperties = {
  background: '#F7F8FA',
  borderRadius: '14px', overflow: 'hidden', margin: '24px 0',
  border: '1px solid #EEF0F4',
};

const goldButtonStyle: React.CSSProperties = {
  backgroundColor: '#BC9C45', color: '#FFFFFF', fontSize: '15px', fontWeight: 700,
  padding: '16px 48px', borderRadius: '12px', textDecoration: 'none', display: 'inline-block',
  boxShadow: '0 4px 16px rgba(188, 156, 69, 0.3)',
};

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: '#FEF2F2', borderRadius: '12px', padding: '20px',
  border: '1px solid #FECACA', margin: '24px 0',
};

const noteStyle: React.CSSProperties = {
  fontSize: '12px', color: '#9CA3AF', lineHeight: '18px',
  margin: '24px 0 0 0', textAlign: 'center' as const,
};
