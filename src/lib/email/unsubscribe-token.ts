import { createHmac, timingSafeEqual } from 'crypto';
import type { NotifEventKey } from '@/lib/notifications/types';

const VALID_CATEGORIES: NotifEventKey[] = ['new_deals', 'document_uploads', 'deal_activity'];

function getSecret(): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('EMAIL_UNSUBSCRIBE_SECRET is not set');
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export interface UnsubscribeTokenPayload {
  uid: string;
  cat: NotifEventKey;
}

export function createUnsubscribeToken({ uid, cat }: UnsubscribeTokenPayload): string {
  const payload = `${uid}.${cat}`;
  const sig = sign(payload);
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;

  let payload: string;
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = sign(payload);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(sig, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;

  const [uid, cat] = payload.split('.');
  if (!uid || !cat) return null;
  if (!VALID_CATEGORIES.includes(cat as NotifEventKey)) return null;
  return { uid, cat: cat as NotifEventKey };
}

export function buildUnsubscribeUrl(uid: string, cat: NotifEventKey): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://reprimeterminal.com';
  const token = createUnsubscribeToken({ uid, cat });
  return `${base}/api/email/unsubscribe?t=${token}`;
}
