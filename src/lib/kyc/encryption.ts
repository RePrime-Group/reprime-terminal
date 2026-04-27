import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

// AES-256-GCM. Output layout (single bytea column in terminal_user_kyc.ssn_encrypted):
//   iv (12 bytes) || authTag (16 bytes) || ciphertext (variable)
//
// Key: 32 raw bytes, stored base64 in KYC_ENCRYPTION_KEY env var.
// Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.KYC_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('KYC_ENCRYPTION_KEY env var is missing — cannot encrypt KYC data.');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(`KYC_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}).`);
  }
  cachedKey = buf;
  return buf;
}

export function encryptSSN(plainText: string): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

/**
 * Encode a Buffer as the Postgres bytea hex literal `\xAABBCC...`.
 *
 * supabase-js / PostgREST does NOT auto-serialise a Node Buffer into bytea —
 * `JSON.stringify(buf)` yields `{"type":"Buffer","data":[...]}`, which the
 * server can't coerce into a bytea column (the row inserts with NULL or junk).
 * Convert to the hex literal before sending to the database.
 */
export function toByteaHex(buf: Buffer): string {
  return '\\x' + buf.toString('hex');
}

/** Encrypt + return as a bytea hex literal ready to hand to supabase-js. */
export function encryptSSNForDb(plainText: string): string {
  return toByteaHex(encryptSSN(plainText));
}

export function decryptSSN(blob: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('SSN ciphertext is malformed (too short).');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Returns "***-**-1234" given a raw SSN. Strips non-digits first. */
export function maskSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) return '***-**-****';
  return `***-**-${digits.slice(-4)}`;
}

/** Constant-time compare for sensitive equality checks. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Normalises whatever supabase-js hands back for a bytea column into a Buffer.
 * PostgREST commonly returns bytea as either a hex string `\xAABB...` or as
 * a node Buffer / Uint8Array depending on the client driver.
 */
export function bufferFromBytea(blob: unknown): Buffer {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === 'string') {
    if (blob.startsWith('\\x') || blob.startsWith('\\X')) return Buffer.from(blob.slice(2), 'hex');
    // Fall back to base64 — used by some PostgREST clients.
    return Buffer.from(blob, 'base64');
  }
  if (
    blob &&
    typeof blob === 'object' &&
    'data' in (blob as Record<string, unknown>) &&
    Array.isArray((blob as { data: unknown }).data)
  ) {
    return Buffer.from((blob as { data: number[] }).data);
  }
  throw new Error('Unsupported bytea payload shape');
}
