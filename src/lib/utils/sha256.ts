// Content-dedup helpers shared by every data-room upload path.
//
// Web Crypto's global `crypto.subtle` is available in both the browser and the
// Node server runtime (Node 20+), so this single implementation works on the
// client upload flows and the server routes/actions alike.

// Hex-encoded SHA-256 of the given bytes.
export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  const view = new Uint8Array(digest);
  let hex = '';
  for (const b of view) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// Content-addressed storage object key: identical bytes → identical object, so
// Supabase Storage itself never holds duplicates. The original extension is
// preserved so in-browser Office/GView previews (which infer the type from the
// URL) still work. Dedup decisions key on the sha256 column, not this path.
export function storageKeyForHash(dealId: string, sha256: string, fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 ? fileName.slice(dot).toLowerCase().replace(/[^a-z0-9.]+/g, '') : '';
  return `${dealId}/${sha256}${ext}`;
}
