'use client';

import { createClient } from '@/lib/supabase/client';
import type { CrmAttachment } from '@/lib/types/database';

export type CrmBucket = 'terminal-investor-files' | 'terminal-investor-photos';

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}

export interface UploadedFile extends CrmAttachment {
  /** storage path, kept so callers can roll back a failed save */
  path: string;
}

/**
 * Upload a single file to a CRM storage bucket via the browser client.
 *
 * - terminal-investor-photos is public → `url` holds the public URL (usable in <img>).
 * - terminal-investor-files is private → `url` holds the storage PATH; resolve it
 *   to a short-lived signed URL with openCrmFile() when the user clicks to view.
 */
export async function uploadCrmFile(
  bucket: CrmBucket,
  scope: string,
  file: File,
): Promise<{ data?: UploadedFile; error?: string }> {
  const supabase = createClient();
  const path = `${scope || 'misc'}/${Date.now()}-${sanitizeName(file.name)}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) return { error: error.message };

  const url =
    bucket === 'terminal-investor-photos'
      ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
      : path; // private: store path, sign on demand

  return {
    data: { name: file.name, url, size: file.size, type: file.type || null, path },
  };
}

/** Best-effort removal of an uploaded object (rollback after a failed save). */
export async function removeCrmFile(bucket: CrmBucket, path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(bucket).remove([path]);
}

/**
 * Open an attachment in a new tab. If the stored `url` is a full URL (public
 * photo) it's opened directly; otherwise it's treated as a private storage path
 * and signed for 60 minutes before opening.
 */
export async function openCrmFile(attachment: CrmAttachment): Promise<void> {
  const ref = attachment.url;
  if (!ref) return;
  if (/^https?:\/\//i.test(ref)) {
    window.open(ref, '_blank', 'noopener,noreferrer');
    return;
  }
  const supabase = createClient();
  const { data } = await supabase.storage
    .from('terminal-investor-files')
    .createSignedUrl(ref, 3600);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
