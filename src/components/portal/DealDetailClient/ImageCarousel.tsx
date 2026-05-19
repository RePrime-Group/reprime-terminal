'use client';

import { useState, useRef } from 'react';

export function ImageCarousel({ urls }: { urls: string[] }) {
  const [current, setCurrent] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxLoading, setLightboxLoading] = useState(true);
  // swipedRef suppresses the img's onClick (lightbox) when the tap was actually a swipe.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  if (urls.length === 0) {
    return (
      <div className="w-full h-[45vh] md:h-[65vh] rounded-2xl overflow-hidden relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0E3470 40%, #1D5FB8 100%)' }}>
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: 'linear-gradient(rgba(188,156,69,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(188,156,69,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
          <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 text-[#BC9C45]/20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 21V7l9-4 9 4v14H3zm2-2h5v-4h4v4h5V8.3l-7-3.1L5 8.3V19zm2-6h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8-4h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z"/>
          </svg>
        </div>
      </div>
    );
  }

  const goNext = () => { setImageLoading(true); setLightboxLoading(true); setCurrent((p) => (p + 1) % urls.length); };
  const goPrev = () => { setImageLoading(true); setLightboxLoading(true); setCurrent((p) => (p - 1 + urls.length) % urls.length); };
  const goTo = (idx: number) => { if (idx !== current) { setImageLoading(true); setLightboxLoading(true); setCurrent(idx); } };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) swipedRef.current = true;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (urls.length <= 1) return;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  return (
    <>
      <div
        className="relative w-full h-[45vh] md:h-[65vh] rounded-2xl overflow-hidden group"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={urls[current]}
          alt={`Property photo ${current + 1}`}
          className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
          onClick={() => {
            if (swipedRef.current) { swipedRef.current = false; return; }
            setLightboxLoading(true);
            setLightboxOpen(true);
          }}
          onLoad={() => { setImageLoading(false); setDisplayIndex(current); }}
        />
        {imageLoading && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#BC9C45] rounded-full animate-spin" />
          </div>
        )}
        {urls.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-[44px] h-[44px] bg-white/90 hover:bg-white shadow-lg text-[#0E3470] rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous photo"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 12L6 8l4-4" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-[44px] h-[44px] bg-white/90 hover:bg-white shadow-lg text-[#0E3470] rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next photo"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {urls.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                    idx === displayIndex ? 'bg-[#BC9C45]' : 'bg-white/50'
                  }`}
                  aria-label={`Go to photo ${idx + 1}`}
                />
              ))}
            </div>
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
              {displayIndex + 1}/{urls.length}
            </div>
          </>
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            aria-label="Close lightbox"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>

          {urls.length > 1 && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold px-4 py-1.5 rounded-full">
              {current + 1} / {urls.length}
            </div>
          )}

          {urls.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              aria-label="Previous photo"
            >
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 12L6 8l4-4" />
              </svg>
            </button>
          )}

          <div className="relative max-h-[85vh] max-w-[90vw] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {lightboxLoading && (
              <div className="absolute inset-0 rounded-lg overflow-hidden flex items-center justify-center" style={{ minWidth: '300px', minHeight: '200px' }}>
                <div className="w-8 h-8 border-2 border-white/20 border-t-[#BC9C45] rounded-full animate-spin" />
              </div>
            )}
            <img
              src={urls[current]}
              alt={`Property photo ${current + 1}`}
              className={`max-h-[85vh] max-w-[90vw] object-contain rounded-lg transition-opacity duration-300 ${lightboxLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setLightboxLoading(false)}
            />
          </div>

          {urls.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              aria-label="Next photo"
            >
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          )}
        </div>
      )}
    </>
  );
}
