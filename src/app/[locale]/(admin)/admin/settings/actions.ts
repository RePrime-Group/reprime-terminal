'use server';

import { revalidatePath } from 'next/cache';
import { getAdminAuth } from '@/lib/auth/requireAdmin';
import { getConnection, deleteConnection } from '@/lib/google/drive';

const SETTINGS_PATH = '/[locale]/admin/settings';

// Connection status for the Settings page. Never returns tokens — only whether
// an account is connected and which email, both safe to show an admin.
export async function getGoogleDriveStatus(): Promise<
  { connected: false } | { connected: true; email: string }
> {
  const auth = await getAdminAuth();
  if (!auth.ok) return { connected: false };

  const conn = await getConnection();
  if (!conn) return { connected: false };
  return { connected: true, email: conn.google_email };
}

// Disconnect the org-wide Google account. Deal↔folder mappings are left intact
// (they simply stop working until an account is reconnected).
export async function disconnectGoogleDrive(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const auth = await getAdminAuth();
  if (!auth.ok) return { ok: false, error: 'Forbidden' };

  await deleteConnection();
  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}
