'use client';

import type React from 'react';
import { useTranslations } from 'next-intl';
import type { TerminalDDDocument } from '@/lib/types/database';

const PHOTOS_PER_PAGE = 16;

interface Props {
  ddLoading: boolean;
  photoDocs: TerminalDDDocument[];
  visiblePhotos: TerminalDDDocument[];
  safePhotoPage: number;
  totalPhotoPages: number;
  setPhotoPage: React.Dispatch<React.SetStateAction<number>>;
  setPhotoLightboxIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setPhotoLightboxLoading: React.Dispatch<React.SetStateAction<boolean>>;
  handleDocumentDownload: (docId: string) => void;
}

export function PhotosTab({
  ddLoading,
  photoDocs,
  visiblePhotos,
  safePhotoPage,
  totalPhotoPages,
  setPhotoPage,
  setPhotoLightboxIndex,
  setPhotoLightboxLoading,
  handleDocumentDownload,
}: Props) {
  const t = useTranslations('portal.dealDetail');
  return (
    <div className="mt-4 md:mt-6 px-4 md:px-8 pb-8 md:pb-10">
      {ddLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : photoDocs.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#EEF0F4] p-10 text-center text-sm text-[#9CA3AF] rp-card-shadow">
          <span className="text-2xl block mb-2">{'📷'}</span>
          {t('photosEmpty')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5 md:gap-2">
            {visiblePhotos.map((doc, i) => {
              const fullUrl = `/api/documents/${doc.id}/download?view=true`;
              const caption = doc.display_name ?? doc.name;
              const absoluteIndex = safePhotoPage * PHOTOS_PER_PAGE + i;
              return (
                <button
                  key={doc.id}
                  type="button"
                  title={caption}
                  onClick={() => {
                    handleDocumentDownload(doc.id);
                    setPhotoLightboxLoading(true);
                    setPhotoLightboxIndex(absoluteIndex);
                  }}
                  className="group relative aspect-square bg-[#F7F8FA] rounded-md overflow-hidden border border-[#EEF0F4] hover:border-[#BC9C45]/50 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fullUrl}
                    alt={caption}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                  />
                </button>
              );
            })}
          </div>

          {totalPhotoPages > 1 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-[12px] text-[#9CA3AF]">
                {`${safePhotoPage * PHOTOS_PER_PAGE + 1}–${Math.min((safePhotoPage + 1) * PHOTOS_PER_PAGE, photoDocs.length)} of ${photoDocs.length}`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePhotoPage === 0}
                  onClick={() => setPhotoPage((p) => Math.max(0, p - 1))}
                  className="w-9 h-9 rounded-lg border border-[#EEF0F4] bg-white text-[#0E3470] flex items-center justify-center transition-colors hover:border-[#BC9C45]/50 hover:text-[#BC9C45] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#EEF0F4] disabled:hover:text-[#0E3470]"
                  aria-label="Previous page"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <div className="text-[12px] text-[#0E3470] font-medium tabular-nums px-1">
                  {`${safePhotoPage + 1} / ${totalPhotoPages}`}
                </div>
                <button
                  type="button"
                  disabled={safePhotoPage >= totalPhotoPages - 1}
                  onClick={() => setPhotoPage((p) => Math.min(totalPhotoPages - 1, p + 1))}
                  className="w-9 h-9 rounded-lg border border-[#EEF0F4] bg-white text-[#0E3470] flex items-center justify-center transition-colors hover:border-[#BC9C45]/50 hover:text-[#BC9C45] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#EEF0F4] disabled:hover:text-[#0E3470]"
                  aria-label="Next page"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
