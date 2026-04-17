import { Text, Section } from '@react-email/components';
import * as React from 'react';
import BaseLayout from './base-layout';

interface TeamRequestAdminEmailProps {
  requestType: 'invite_limit' | 'permission';
  investorName: string;
  investorEmail: string;
  requestedTotal?: number;
  currentLimit?: number;
  targetName?: string;
  targetEmail?: string;
  permissionKey?: string;
  reason?: string | null;
  adminUrl: string;
}

export default function TeamRequestAdminEmail({
  requestType,
  investorName,
  investorEmail,
  requestedTotal,
  currentLimit,
  targetName,
  targetEmail,
  permissionKey,
  reason,
  adminUrl,
}: TeamRequestAdminEmailProps) {
  const heading =
    requestType === 'invite_limit'
      ? 'Invite Limit Raise Requested'
      : 'Team Permission Approval Requested';

  const humanPermission = permissionKey ? permissionKey.replace(/_/g, ' ') : '';

  return (
    <BaseLayout preview={`${investorName} has submitted a team request`}>
      <Text style={headingStyle}>{heading}</Text>

      <Text style={bodyStyle}>
        <strong style={{ color: '#0E3470' }}>{investorName}</strong> ({investorEmail}) has submitted
        a team request that needs your review.
      </Text>

      <Section style={detailCardStyle}>
        {requestType === 'invite_limit' ? (
          <>
            <Row label="Current limit" value={String(currentLimit ?? '—')} />
            <Row label="Requested total" value={String(requestedTotal ?? '—')} />
          </>
        ) : (
          <>
            <Row label="Team member" value={`${targetName ?? ''}${targetEmail ? ` (${targetEmail})` : ''}`} />
            <Row label="Permission" value={humanPermission} />
          </>
        )}
        {reason && <Row label="Reason" value={reason} />}
      </Section>

      <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
        <a href={adminUrl} style={linkButtonStyle}>Review in Admin</a>
      </Section>

      <Text style={noteStyle}>
        Approve or reject this request in the Team Requests queue.
      </Text>
    </BaseLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'block', marginBottom: '10px' }}>
      <Text style={rowLabel}>{label}</Text>
      <Text style={rowValue}>{value}</Text>
    </div>
  );
}

const headingStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#0E3470',
  margin: '0 0 16px 0',
  lineHeight: '28px',
  fontFamily: 'Georgia, serif',
};
const bodyStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#4B5563',
  lineHeight: '22px',
  margin: '0 0 16px 0',
};
const detailCardStyle: React.CSSProperties = {
  backgroundColor: '#F9FAFB',
  borderRadius: '10px',
  padding: '18px 20px',
  border: '1px solid #EEF0F4',
  margin: '16px 0',
};
const rowLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#6B7280',
  margin: '0 0 2px 0',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
};
const rowValue: React.CSSProperties = {
  fontSize: '13px',
  color: '#0F1B2D',
  margin: 0,
};
const linkButtonStyle: React.CSSProperties = {
  backgroundColor: '#0E3470',
  color: '#FFFFFF',
  fontSize: '13px',
  fontWeight: 700,
  padding: '12px 28px',
  borderRadius: '10px',
  textDecoration: 'none',
  display: 'inline-block',
};
const noteStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#9CA3AF',
  lineHeight: '18px',
  margin: '24px 0 0 0',
};
