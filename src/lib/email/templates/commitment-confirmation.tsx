import { Text, Button, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface CommitmentConfirmationProps {
  investorName: string;
  investorEmail?: string;
  investorPhone?: string;
  dealName: string;
  city: string;
  state: string;
  commitType: string;
  depositAmount?: string;
  portalUrl: string;
  isAdmin?: boolean;
}

export default function CommitmentConfirmation({
  investorName,
  investorEmail,
  investorPhone,
  dealName,
  city,
  state,
  commitType,
  depositAmount,
  portalUrl,
  isAdmin = false,
}: CommitmentConfirmationProps) {
  const isPrimary = commitType === 'primary';

  return (
    <BaseLayout preview={`${isPrimary ? 'Deal Committed' : 'Backup Position'}: ${dealName}`}>
      <div style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
        <table cellPadding="0" cellSpacing="0" align="center" style={{ margin: '0 auto 16px', borderCollapse: 'collapse' }}>
          <tr>
            <td style={badgeCellStyle}>
              <span style={{ fontSize: '24px', color: '#FFFFFF' }}>✓</span>
            </td>
          </tr>
        </table>
      </div>

      <Text style={headingStyle}>
        {isAdmin
          ? `New ${isPrimary ? 'Commitment' : 'Backup'} Registered`
          : isPrimary ? 'Deal Commitment Confirmed' : 'Backup Position Confirmed'
        }
      </Text>

      <Text style={bodyStyle}>
        {isAdmin
          ? `${investorName} has registered as a ${isPrimary ? 'primary buyer' : 'backup buyer'} for the following deal.`
          : isPrimary
            ? 'Your commitment has been registered. Our team will contact you within 24 hours with wire instructions and next steps.'
            : 'Your backup position has been registered. You will be notified immediately if the primary position becomes available.'
        }
      </Text>

      <div style={dealCardStyle}>
        <div style={{ padding: '24px' }}>
          <Text style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', color: '#D4A843', margin: '0 0 8px 0' }}>
            {isPrimary ? 'COMMITTED DEAL' : 'BACKUP POSITION'}
          </Text>
          <Text style={{ fontSize: '24px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px 0', fontFamily: 'Georgia, serif' }}>
            {dealName}
          </Text>
          <Text style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            {city}, {state}
          </Text>
          {depositAmount && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Text style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', margin: '0 0 4px 0' }}>
                DEPOSIT
              </Text>
              <Text style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
                {depositAmount}
              </Text>
            </div>
          )}

          {(investorPhone || investorEmail) && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Text style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', color: 'rgba(255,255,255,0.4)', margin: '0 0 6px 0' }}>
                INVESTOR CONTACT
              </Text>
              <Text style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', margin: '0 0 2px 0' }}>
                {investorName}
              </Text>
              {investorPhone && (
                <Text style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: '0 0 2px 0' }}>
                  {investorPhone}
                </Text>
              )}
              {investorEmail && (
                <Text style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: 0 }}>
                  {investorEmail}
                </Text>
              )}
            </div>
          )}
        </div>
      </div>

      <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
        <Button style={goldButtonStyle} href={portalUrl}>
          View Deal Details
        </Button>
      </Section>

      {isPrimary && (
        <div style={infoBoxStyle}>
          <Text style={{ fontSize: '12px', color: '#6B7280', margin: 0, lineHeight: '20px' }}>
            <strong style={{ color: '#0E3470' }}>Next steps:</strong><br />
            1. Our team will send wire instructions within 24 hours<br />
            2. Wire deposit within 72 hours of receiving instructions<br />
            3. Deposit is held in escrow by the title company<br />
            4. Due diligence period begins upon wire confirmation
          </Text>
        </div>
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
  background: 'linear-gradient(135deg, #BC9C45, #D4B96A)',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  lineHeight: '52px',
};

const dealCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #07090F 0%, #0A1628 40%, #0E3470 100%)',
  borderRadius: '14px', overflow: 'hidden', margin: '24px 0',
};

const goldButtonStyle: React.CSSProperties = {
  backgroundColor: '#BC9C45', color: '#FFFFFF', fontSize: '15px', fontWeight: 700,
  padding: '16px 48px', borderRadius: '12px', textDecoration: 'none', display: 'inline-block',
  boxShadow: '0 4px 16px rgba(188, 156, 69, 0.3)',
};

const infoBoxStyle: React.CSSProperties = {
  backgroundColor: '#F7F8FA', borderRadius: '12px', padding: '20px',
  border: '1px solid #EEF0F4', margin: '24px 0',
};

const noteStyle: React.CSSProperties = {
  fontSize: '12px', color: '#9CA3AF', lineHeight: '18px',
  margin: '24px 0 0 0', textAlign: 'center' as const,
};
