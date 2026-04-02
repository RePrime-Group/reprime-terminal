'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useCountdown } from '@/lib/hooks/useCountdown';
import { createClient } from '@/lib/supabase/client';
import type { TerminalDDFolder, TerminalDDDocument } from '@/lib/types/database';

interface TaskItem {
  id: string;
  name: string;
  status: string;
  stage: string;
}

interface DataRoomTabProps {
  folders: (TerminalDDFolder & { documents: TerminalDDDocument[] })[];
  tasks: TaskItem[];
  dealId: string;
  dealName: string;
  investorName: string;
  investorEmail: string;
  ddDeadline: string | null;
  closeDeadline: string | null;
  extensionDeadline: string | null;
  onViewDocument: (url: string, name: string, storagePath?: string) => void;
  onDocumentDownload: (docId: string) => void;
}

function formatFileSize(size: string | null): string {
  if (!size) return '—';
  const n = parseInt(size);
  if (isNaN(n)) return size;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const FILE_TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  'application/pdf': { color: '#DC2626', bg: '#FEE2E2', label: 'PDF' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { color: '#16A34A', bg: '#DCFCE7', label: 'XLS' },
  'application/vnd.ms-excel': { color: '#16A34A', bg: '#DCFCE7', label: 'XLS' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { color: '#2563EB', bg: '#DBEAFE', label: 'DOC' },
  'application/msword': { color: '#2563EB', bg: '#DBEAFE', label: 'DOC' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { color: '#EA580C', bg: '#FFF7ED', label: 'PPT' },
  'application/zip': { color: '#9333EA', bg: '#F3E8FF', label: 'ZIP' },
  'application/x-zip-compressed': { color: '#9333EA', bg: '#F3E8FF', label: 'ZIP' },
  'image/jpeg': { color: '#EA580C', bg: '#FFF7ED', label: 'IMG' },
  'image/png': { color: '#EA580C', bg: '#FFF7ED', label: 'IMG' },
  'image/webp': { color: '#EA580C', bg: '#FFF7ED', label: 'IMG' },
};

function getFileTypeFromName(name: string): { color: string; bg: string; label: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const extMap: Record<string, { color: string; bg: string; label: string }> = {
    pdf: { color: '#DC2626', bg: '#FEE2E2', label: 'PDF' },
    xlsx: { color: '#16A34A', bg: '#DCFCE7', label: 'XLS' },
    xls: { color: '#16A34A', bg: '#DCFCE7', label: 'XLS' },
    docx: { color: '#2563EB', bg: '#DBEAFE', label: 'DOC' },
    doc: { color: '#2563EB', bg: '#DBEAFE', label: 'DOC' },
    pptx: { color: '#EA580C', bg: '#FFF7ED', label: 'PPT' },
    ppt: { color: '#EA580C', bg: '#FFF7ED', label: 'PPT' },
    zip: { color: '#9333EA', bg: '#F3E8FF', label: 'ZIP' },
    jpg: { color: '#EA580C', bg: '#FFF7ED', label: 'IMG' },
    jpeg: { color: '#EA580C', bg: '#FFF7ED', label: 'IMG' },
    png: { color: '#EA580C', bg: '#FFF7ED', label: 'IMG' },
    webp: { color: '#EA580C', bg: '#FFF7ED', label: 'IMG' },
  };
  return extMap[ext] ?? { color: '#6B7280', bg: '#F3F4F6', label: ext.toUpperCase() || 'FILE' };
}

function FileTypeBadge({ doc }: { doc: TerminalDDDocument }) {
  const config = FILE_TYPE_CONFIG[doc.file_type ?? ''] ?? getFileTypeFromName(doc.name);
  return (
    <span
      className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-[11px] font-bold shrink-0"
      style={{ backgroundColor: config.bg, color: config.color, letterSpacing: '0.02em' }}
    >
      {config.label}
    </span>
  );
}

export default function DataRoomTab({
  folders, tasks, dealId, dealName, investorName, investorEmail,
  ddDeadline, closeDeadline, extensionDeadline,
  onViewDocument, onDocumentDownload,
}: DataRoomTabProps) {
  const t = useTranslations('portal.dataRoom');

  // Build categories from real folders
  const allDocs = folders.flatMap((f) => f.documents);
  const uploadedDocs = allDocs.filter((d) => !!d.storage_path);
  const totalExpected = allDocs.length;

  const categoryList = [
    { id: 'all', label: t('allDocuments'), icon: '\uD83D\uDCC2', count: uploadedDocs.length },
    ...folders.map((f) => ({
      id: f.id,
      label: f.name.replace(/^\d+_/, '').replace(/_/g, ' '),
      icon: f.icon || '\uD83D\uDCC1',
      count: f.documents.filter((d) => !!d.storage_path).length,
    })),
  ];

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  // Filter documents
  const filteredDocs = activeCategory === 'all'
    ? uploadedDocs.filter((d) => !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : (folders.find((f) => f.id === activeCategory)?.documents ?? [])
        .filter((d) => !!d.storage_path)
        .filter((d) => !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedDocs.size === filteredDocs.length && filteredDocs.length > 0) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(filteredDocs.map((d) => d.id)));
    }
  };

  const activeCat = categoryList.find((c) => c.id === activeCategory);

  return (
    <div>
      {/* Header area */}
      <div className="px-6 pt-3 pb-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-[#9CA3AF]">
            {t('watermarked')} <span className="font-semibold text-[#0E3470]">{investorName}</span> · {investorEmail}
          </p>
          <a
            href={`/api/deals/${dealId}/package`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F1B2D] text-white text-[13px] font-semibold hover:bg-[#1a2a42] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('downloadAll')} ({uploadedDocs.length})
          </a>
        </div>
      </div>

      {/* Main layout: sidebar + document list */}
      <div className="flex gap-5 px-6 pb-6">
        {/* Sidebar */}
        <div className="w-[220px] shrink-0">
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            {categoryList.map((cat, i) => {
              const isActive = activeCategory === cat.id;
              const isEmpty = cat.count === 0 && cat.id !== 'all';
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setSelectedDocs(new Set()); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] transition-all ${
                    i < categoryList.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                  } ${
                    isActive
                      ? 'bg-[#0F1B2D] text-white font-semibold'
                      : isEmpty
                        ? 'text-[#9CA3AF] opacity-50 cursor-default'
                        : 'text-[#374151] hover:bg-[#F9FAFB]'
                  }`}
                >
                  <span className="text-[14px] w-5 text-center">{cat.icon}</span>
                  <span className="flex-1 truncate">{cat.label}</span>
                  {cat.count > 0 && (
                    <span
                      className={`text-[11px] font-bold px-[7px] py-[2px] rounded-md ${
                        isActive
                          ? 'text-[#C8A951] bg-[rgba(200,169,81,0.15)]'
                          : 'text-[#9CA3AF] bg-[#F3F4F6]'
                      }`}
                    >
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Request from team */}
          <div className="mt-4 p-4 bg-white rounded-xl border border-[#E5E7EB] text-center">
            <p className="text-[12px] text-[#6B7280] mb-2.5 leading-[1.4]">
              {t('missingDocument')}
            </p>
            <a
              href="https://wa.me/19177030365?text=Hi, I need a document for the data room"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2 px-3 rounded-lg border-[1.5px] border-[#C8A951] text-[#0F1B2D] text-[12px] font-semibold hover:bg-[#FDF8ED] transition-colors"
            >
              {t('requestFromTeam')}
            </a>
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 min-w-0">
          {/* Search + actions bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder={`${t('searchPlaceholder')} ${activeCat?.label || t('documents')}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full py-[9px] pl-9 pr-3 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#0F1B2D] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#C8A951]/20 focus:border-[#C8A951] transition-all"
              />
            </div>
            {selectedDocs.size > 0 && (
              <button
                onClick={() => {
                  selectedDocs.forEach((id) => {
                    onDocumentDownload(id);
                    const doc = allDocs.find((d) => d.id === id);
                    if (doc) {
                      onViewDocument(`/api/documents/${id}/download?view=true`, doc.name, doc.storage_path ?? undefined);
                    }
                  });
                }}
                className="py-[9px] px-3.5 rounded-lg bg-[#C8A951] text-[#0F1B2D] text-[12px] font-semibold whitespace-nowrap hover:bg-[#b89a42] transition-colors"
              >
                ⬇ {t('downloadSelected', { count: selectedDocs.size })}
              </button>
            )}
          </div>

          {/* Column headers */}
          <div className="flex items-center px-4 pb-2 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.06em]">
            <div className="w-5 me-3 flex items-center">
              <input
                type="checkbox"
                checked={filteredDocs.length > 0 && selectedDocs.size === filteredDocs.length}
                onChange={toggleAll}
                className="cursor-pointer accent-[#C8A951]"
              />
            </div>
            <div className="w-10 me-3">{t('type')}</div>
            <div className="flex-1">{t('document')}</div>
            <div className="w-20 text-end">{t('size')}</div>
            <div className="w-[110px] text-end">{t('uploaded')}</div>
            <div className="w-[72px]" />
          </div>

          {/* Document rows */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            {filteredDocs.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[#9CA3AF]">
                {searchQuery
                  ? t('noSearchResults')
                  : t('noDocumentsInCategory')}
              </div>
            ) : (
              filteredDocs.map((doc, i) => {
                const isSelected = selectedDocs.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                      i < filteredDocs.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                    } ${isSelected ? 'bg-[rgba(200,169,81,0.04)]' : 'hover:bg-[#FAFBFC]'}`}
                  >
                    <div className="w-5 me-3 flex items-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDoc(doc.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer accent-[#C8A951]"
                      />
                    </div>
                    <div className="w-10 me-3">
                      <FileTypeBadge doc={doc} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#0F1B2D] truncate">
                        {doc.name}
                      </div>
                    </div>
                    <div className="w-20 text-end text-[12px] text-[#9CA3AF]">
                      {formatFileSize(doc.file_size)}
                    </div>
                    <div className="w-[110px] text-end text-[12px] text-[#9CA3AF]">
                      {formatDate(doc.created_at)}
                    </div>
                    <div className="w-[72px] flex justify-end gap-1.5">
                      {/* View */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDocumentDownload(doc.id);
                          onViewDocument(`/api/documents/${doc.id}/download?view=true`, doc.name, doc.storage_path ?? undefined);
                        }}
                        className="w-7 h-7 rounded-md border border-[#E5E7EB] bg-transparent text-[#6B7280] flex items-center justify-center hover:bg-[#0F1B2D] hover:text-white hover:border-[#0F1B2D] transition-all"
                        title={t('viewOnly')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      {/* Download */}
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDocumentDownload(doc.id);
                        }}
                        className="w-7 h-7 rounded-md border border-[#E5E7EB] bg-transparent text-[#6B7280] flex items-center justify-center hover:bg-[#0F1B2D] hover:text-white hover:border-[#0F1B2D] transition-all"
                        title={t('download')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer info */}
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-[12px] text-[#9CA3AF]">
              {filteredDocs.length} {t('document')}{filteredDocs.length !== 1 ? 's' : ''}
              {activeCategory !== 'all' && ` ${t('inCategory')} ${activeCat?.label}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
