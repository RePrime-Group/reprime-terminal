// Shared folder + file icons for the data room tree. Used by both the admin
// tree and the investor-facing read-only tree so the visual language stays
// consistent across roles.

// FolderIcon — single filled folder glyph. Replaces the per-folder emoji that
// used to live on terminal_dd_folders.icon.
export function FolderIcon({ className = 'w-[22px] h-[22px]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} text-[#1a1a1a] shrink-0`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 6a2 2 0 012-2h4.5l2 2H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
    </svg>
  );
}

// FileIcon — page outline with a small extension label in the bottom-left.
// Pass the raw document name or explicit extension; we uppercase and clamp
// to 4 chars so long extensions don't overflow.
export function FileIcon({
  name,
  extension,
  className = 'w-[22px] h-[26px]',
}: {
  name?: string;
  extension?: string;
  className?: string;
}) {
  const raw = extension ?? (name ? name.split('.').pop() ?? '' : '');
  const ext = raw.toUpperCase().slice(0, 4);

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 28 32" className="w-full h-full text-[#6B7280]">
        <path
          d="M6 2h12l6 6v20a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"
          fill="white"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M18 2v6h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {ext && (
        <span className="absolute bottom-[2px] left-[1px] px-[2.5px] py-[0.5px] rounded-[2px] bg-[#0F1B2D] text-white text-[7px] font-bold leading-[1.2] tracking-wide">
          {ext}
        </span>
      )}
    </span>
  );
}
