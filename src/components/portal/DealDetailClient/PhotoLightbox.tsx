'use client';

import type React from 'react';
import type { TerminalDDDocument } from '@/lib/types/database';

interface Props {
  photoDocs: TerminalDDDocument[];
  photoLightboxIndex: number;
  photoLightboxLoading: boolean;
  setPhotoLightboxIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setPhotoLightboxLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function PhotoLightbox({ photoDocs, photoLightboxIndex, photoLightboxLoading, setPhotoLightboxIndex, setPhotoLightboxLoading }: Props) {
  const doc = photoDocs[photoLightboxIndex];
  if (!doc) return null;

  const url = `/api/documents/${doc.id}/download?view=true`;
  const caption = doc.display_name ?? doc.name;

  const goPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPhotoLightboxLoading(true);
    setPhotoLightboxIndex((i: number | null) => (i === null ? null : (i - 1 + photoDocs.length) % photoDocs.length));
  };
  const goNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPhotoLightboxLoading(true);
    setPhotoLightboxIndex((i: number | null) => (i === null ? null : (i + 1) % photoDocs.length));
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
      onClick={() => setPhotoLightboxIndex(null)}
    >
      <button
        type="button"
        onClick={() => setPhotoLightboxIndex(null)}
        className="absolute top-5 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
        aria-label="Close lightbox"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>

      {photoDocs.length > 1 && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold px-4 py-1.5 rounded-full">
          {photoLightboxIndex + 1} / {photoDocs.length}
        </div>
      )}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 max-w-[80vw] bg-white/10 backdrop-blur-sm text-white text-[12px] px-4 py-1.5 rounded-full truncate">
        {caption}
      </div>

      {photoDocs.length > 1 && (
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          aria-label="Previous photo"
        >
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8l4-4" />
          </svg>
        </button>
      )}

      <div className="relative max-h-[85vh] max-w-[90vw] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {photoLightboxLoading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ minWidth: '300px', minHeight: '200px' }}>
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#BC9C45] rounded-full animate-spin" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={doc.id}
          src={url}
          alt={caption}
          className={`max-h-[85vh] max-w-[90vw] object-contain rounded-lg transition-opacity duration-200 ${photoLightboxLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setPhotoLightboxLoading(false)}
        />
      </div>

      {photoDocs.length > 1 && (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          aria-label="Next photo"
        >
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      )}
    </div>
  );
}
