'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TerminalDDFolder, TerminalDDDocument } from '@/lib/types/database';
import { FileTypeBadge } from './MetricCard';

export function DDFolderCard({
  folder,
  dealId,
  onDocumentDownload,
  onViewDocument,
}: {
  folder: TerminalDDFolder & { documents: TerminalDDDocument[] };
  dealId: string;
  onDocumentDownload: (docId: string) => void;
  onViewDocument: (url: string, name: string, storagePath?: string) => void;
}) {
  const t = useTranslations('portal.dealDetail');
  const [expanded, setExpanded] = useState(false);
  const docCount = folder.documents.length;

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] overflow-hidden cursor-pointer hover:border-[#BC9C45] transition-colors rp-card-shadow">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-[#F7F8FA] flex items-center justify-center text-lg">
          {folder.icon ?? '📁'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-[#0E3470] truncate">
            {folder.name}
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            {t('documentsCount', { count: docCount })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-[#9CA3AF] transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[#EEF0F4]">
          {folder.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 py-3 px-4 border-b border-[#EEF0F4] last:border-0"
            >
              <FileTypeBadge fileType={doc.file_type} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#0E3470] font-medium truncate">
                  {doc.name}
                </div>
                <div className="text-[11px] text-[#9CA3AF]">
                  {doc.file_size ?? t('unknownSize')}
                </div>
              </div>
              {(doc.file_type === 'application/pdf' || doc.name?.endsWith('.pdf') || doc.file_type?.startsWith('image/') || /\.(xlsx?|docx?|pptx?)$/i.test(doc.name)) && (
                <button
                  onClick={() => {
                    onDocumentDownload(doc.id);
                    onViewDocument(`/api/documents/${doc.id}/download?view=true`, doc.name, doc.storage_path ?? undefined);
                  }}
                  className="text-[#BC9C45] hover:text-[#A88A3D] transition-colors"
                  aria-label={`View ${doc.name}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}
              <a
                href={`/api/documents/${doc.id}/download`}
                onClick={() => onDocumentDownload(doc.id)}
                className="text-[#1D5FB8] hover:text-[#0E3470] transition-colors"
                aria-label={`Download ${doc.name}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
            </div>
          ))}
          {folder.documents.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[#9CA3AF]">
              <span className="text-2xl block mb-2">{'⌛'}</span>
              {t('documentsPendingUpload')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
