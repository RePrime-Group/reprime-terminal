import imageCompression from 'browser-image-compression';

// Supabase's image-render endpoint refuses sources >25MB ("Invalid source
// image" 422), and even within the limit, raw 30-MP marketing photos waste
// bandwidth on every investor page load. Re-encode anything bigger than this
// down to 2400px / quality 82 — visually identical for marketing use, ~2-4MB
// typical output, so the render endpoint will gladly transform thumbnails.
const COMPRESS_THRESHOLD_BYTES = 1024 * 1024; // 1 MB
const COMPRESS_TARGET_MAX_BYTES = 5; // browser-image-compression takes MB
const COMPRESS_MAX_DIMENSION = 2400;

// Subset of image/* MIMEs the canvas re-encoder can actually handle. HEIC,
// TIFF, SVG, etc. fall through unchanged.
const COMPRESSIBLE_MIMES = new Set([
  'image/jpeg',
  'image/pjpeg',
  'image/png',
  'image/webp',
]);

/**
 * Browser-side image re-encoder. If the input is a JPEG/PNG/WebP over 1MB,
 * resizes to a max dimension of 2400px at quality 0.82 (target ≤5MB), keeping
 * the original filename. Falls back to the original `File` if compression
 * fails or makes the file larger.
 */
export async function maybeCompressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_MIMES.has(file.type)) return file;
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return file;
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: COMPRESS_TARGET_MAX_BYTES,
      maxWidthOrHeight: COMPRESS_MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.82,
    });
    if (compressed.size >= file.size) return file;
    // browser-image-compression returns a Blob when input is a Blob; for File
    // input it returns a File, but type-narrowed as Blob. Wrap to guarantee
    // a File with the original name preserved.
    return new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
