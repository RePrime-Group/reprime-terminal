import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const PHOTO_BUCKET = 'terminal-deal-photos';
const MAX_PHOTOS = 3;
const PHOTO_TIMEOUT_MS = 15_000;
const MAX_BYTES = 10 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

export interface UploadedPhoto {
  storagePath: string;
  displayOrder: number;
}

/**
 * Downloads up to `MAX_PHOTOS` images from the supplied URLs and uploads them
 * to the `terminal-deal-photos` bucket under `<dealId>/<index>-<random>.<ext>`.
 *
 * Per-photo failures are swallowed and surface in `errors`; the function
 * never throws. Caller is expected to insert `terminal_deal_photos` rows
 * pointing to each returned `storagePath`.
 */
export async function downloadAndUploadPhotos(
  supabase: SupabaseClient,
  dealId: string,
  imageUrls: string[],
): Promise<{ uploaded: UploadedPhoto[]; errors: string[] }> {
  const uploaded: UploadedPhoto[] = [];
  const errors: string[] = [];
  const candidates = imageUrls.slice(0, MAX_PHOTOS);

  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];
    try {
      const file = await fetchImage(url);
      const path = `${dealId}/${i}-${crypto.randomUUID()}.${file.ext}`;
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file.bytes, {
          contentType: file.contentType,
          upsert: false,
        });
      if (upErr) {
        errors.push(`photo ${i + 1}: ${upErr.message}`);
        continue;
      }
      uploaded.push({ storagePath: path, displayOrder: i });
    } catch (err) {
      errors.push(`photo ${i + 1}: ${err instanceof Error ? err.message : 'fetch failed'}`);
    }
  }

  return { uploaded, errors };
}

async function fetchImage(url: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHOTO_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error(`not an image (${contentType || 'unknown'})`);
    const ext = EXT_BY_MIME[contentType] ?? extFromUrl(url) ?? 'jpg';

    const lenHeader = res.headers.get('content-length');
    if (lenHeader && Number(lenHeader) > MAX_BYTES) throw new Error('image too large');

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error('image too large');
    return { bytes: buf, contentType, ext };
  } finally {
    clearTimeout(timer);
  }
}

function extFromUrl(url: string): string | null {
  const m = url.split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : null;
}
