'use client';

import { useState, useEffect, useRef } from 'react';
import type { TerminalDDFolder, TerminalDDDocument } from '@/lib/types/database';

interface DataRoomTabProps {
  folders: (TerminalDDFolder & { documents: TerminalDDDocument[] })[];
  dealId: string;
  investorName: string;
  investorEmail: string;
  onViewDocument: (url: string, name: string) => void;
  onDocumentDownload: (docId: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  verified: { label: 'Verified', color: '#0B8A4D', bg: '#ECFDF5', icon: '✓' },
  pending: { label: 'Pending Review', color: '#D97706', bg: '#FFFBEB', icon: '◷' },
  requested: { label: 'Requested', color: '#9CA3AF', bg: '#F7F8FA', icon: '↗' },
  notrequired: { label: 'Not Required', color: '#D1D5DB', bg: '#F7F8FA', icon: '—' },
};

function getDocStatus(doc: TerminalDDDocument): string {
  if (doc.doc_status) return doc.doc_status;
  return doc.is_verified ? 'verified' : 'pending';
}

function getFolderColor(name: string): { color: string; bg: string } {
  const n = name.toLowerCase();
  if (n.includes('financial') || n.includes('fiscal')) return { color: '#1D5FB8', bg: '#EFF6FF' };
  if (n.includes('legal') || n.includes('lease')) return { color: '#0E3470', bg: '#EEF0F8' };
  if (n.includes('environment')) return { color: '#0B8A4D', bg: '#ECFDF5' };
  if (n.includes('property') || n.includes('condition') || n.includes('site')) return { color: '#D97706', bg: '#FFFBEB' };
  if (n.includes('tenant') || n.includes('investor')) return { color: '#009080', bg: '#ECFDF8' };
  if (n.includes('fire') || n.includes('safety')) return { color: '#DC2626', bg: '#FEF2F2' };
  if (n.includes('insurance')) return { color: '#6B7280', bg: '#F7F8FA' };
  if (n.includes('elevator') || n.includes('operation')) return { color: '#D97706', bg: '#FFFBEB' };
  if (n.includes('photo') || n.includes('plan')) return { color: '#1D5FB8', bg: '#EFF6FF' };
  if (n.includes('market') || n.includes('research') || n.includes('om')) return { color: '#BC9C45', bg: '#FDF8ED' };
  return { color: '#0E3470', bg: '#EEF0F8' };
}

function formatFileSize(size: string | null): string {
  if (!size) return '—';
  const n = parseInt(size);
  if (isNaN(n)) return size;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

/* Animated number counter */
function AnimNum({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      setVal(Math.round(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);
  return <>{val}</>;
}

export default function DataRoomTab({
  folders,
  dealId,
  investorName,
  investorEmail,
  onViewDocument,
  onDocumentDownload,
}: DataRoomTabProps) {
  const [activeFolder, setActiveFolder] = useState(folders[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');

  const allDocs = folders.flatMap((f) => f.documents);
  const totalDocs = allDocs.length;
  const verifiedDocs = allDocs.filter((d) => getDocStatus(d) === 'verified').length;
  const pendingDocs = allDocs.filter((d) => getDocStatus(d) === 'pending').length;
  const requestedDocs = allDocs.filter((d) => getDocStatus(d) === 'requested').length;
  const verifiedPct = totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0;

  const activeFolderData = folders.find((f) => f.id === activeFolder);
  const filteredDocs = activeFolderData?.documents.filter(
    (d) => !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      {/* Watermark notice bar */}
      <div className="bg-gradient-to-r from-[#FDF8ED] to-[#FBF3DC] border-b border-[#ECD9A0]/25 px-6 py-3 rounded-t-xl flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-[#BC9C45]/10 flex items-center justify-center shrink-0" style={{ animation: 'pulse 3s ease-in-out infinite' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <div className="text-[12px]">
          <span className="font-semibold text-[#0E3470]">All documents are view-only.</span>{' '}
          <span className="text-[#4B5563]">Watermarked with</span>{' '}
          <span className="font-bold text-[#0E3470]">{investorName}</span>{' '}
          <span className="text-[#6B7280]">· {investorEmail} · {now}. Downloads disabled.</span>
        </div>
      </div>

      {/* Summary stats panel */}
      <div className="bg-white border-b border-[#EEF0F4] px-6 py-5">
        <div className="flex items-center gap-6">
          {/* Progress ring */}
          <div className="relative w-[72px] h-[72px] shrink-0">
            <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="36" cy="36" r="29" fill="none" stroke="#EEF0F4" strokeWidth="5" />
              <circle
                cx="36" cy="36" r="29" fill="none" stroke="#0B8A4D" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 29}
                strokeDashoffset={2 * Math.PI * 29 * (1 - verifiedPct / 100)}
                style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[18px] font-bold text-[#0E3470] tabular-nums"><AnimNum target={verifiedPct} />%</span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="flex gap-4 flex-1">
            {[
              { label: 'TOTAL', value: totalDocs, color: '#0E3470', border: '#0E3470' },
              { label: 'VERIFIED', value: verifiedDocs, color: '#0B8A4D', border: '#0B8A4D' },
              { label: 'PENDING', value: pendingDocs, color: '#D97706', border: '#D97706' },
              { label: 'REQUESTED', value: requestedDocs, color: '#9CA3AF', border: '#9CA3AF' },
            ].map((s) => (
              <div
                key={s.label}
                className="flex-1 rounded-xl p-3.5 bg-[#F7F8FA] border-l-[3px]"
                style={{ borderLeftColor: s.border }}
              >
                <div className="text-[8px] font-bold uppercase tracking-[2px]" style={{ color: s.color }}>{s.label}</div>
                <div className="text-[24px] font-bold tabular-nums mt-0.5" style={{ color: s.color }}>
                  <AnimNum target={s.value} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main layout: dark sidebar + content */}
      <div className="flex gap-0 bg-white rounded-b-xl border border-[#EEF0F4] border-t-0 overflow-hidden" style={{ minHeight: 480 }}>
        {/* Dark category sidebar */}
        <div className="w-[240px] shrink-0" style={{ background: 'linear-gradient(180deg, #0A1628 0%, #0E3470 100%)' }}>
          <div className="p-3">
            {folders.map((folder) => {
              const fc = getFolderColor(folder.name);
              const folderDocs = folder.documents;
              const folderVerified = folderDocs.filter((d) => getDocStatus(d) === 'verified').length;
              const folderTotal = folderDocs.length;
              const isActive = activeFolder === folder.id;

              return (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={`w-full text-left px-3.5 py-3 rounded-lg mb-1 transition-all ${
                    isActive
                      ? 'bg-white/[0.12] border border-white/[0.08]'
                      : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] shrink-0"
                      style={{ backgroundColor: `${fc.color}25` }}
                    >
                      {folder.icon || '📁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] font-semibold truncate ${isActive ? 'text-white' : 'text-white/70'}`}>
                        {folder.name.replace(/^\d+_/, '').replace(/_/g, ' ')}
                      </div>
                      <div className="text-[10px] text-white/30 mt-0.5 tabular-nums">
                        {folderVerified}/{folderTotal} verified
                      </div>
                    </div>
                  </div>
                  {/* Mini progress bar */}
                  <div className="h-[3px] rounded-full bg-white/[0.08] mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${folderTotal > 0 ? (folderVerified / folderTotal) * 100 : 0}%`,
                        backgroundColor: fc.color,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 min-w-0">
          {/* Search + folder header */}
          <div className="px-5 py-4 border-b border-[#EEF0F4] flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[16px]"
                style={{
                  backgroundColor: activeFolderData ? `${getFolderColor(activeFolderData.name).color}10` : '#F7F8FA',
                }}
              >
                {activeFolderData?.icon || '📁'}
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[#0E3470]">
                  {activeFolderData?.name.replace(/^\d+_/, '').replace(/_/g, ' ') || 'Documents'}
                </h3>
                <span className="text-[11px] text-[#9CA3AF]">{filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 text-[12px] border border-[#EEF0F4] rounded-lg w-[220px] focus:outline-none focus:ring-[3px] focus:ring-[#BC9C45]/15 focus:border-[#BC9C45] transition-all"
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid px-5 py-2.5 border-b border-[#EEF0F4] bg-[#FAFBFC]" style={{ gridTemplateColumns: '2.2fr 100px 70px 80px 130px 80px' }}>
            {['Document', 'Date', 'Pages', 'Size', 'Status', ''].map((h) => (
              <div key={h} className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-[2px]">{h}</div>
            ))}
          </div>

          {/* Document rows */}
          <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
            {filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-[13px] text-[#9CA3AF]">
                {totalDocs === 0 ? 'Documents pending upload' : 'No documents match your search'}
              </div>
            ) : (
              filteredDocs.map((doc, i) => {
                const status = getDocStatus(doc);
                const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
                const canView = status === 'verified' || status === 'pending';
                const fc = activeFolderData ? getFolderColor(activeFolderData.name) : { color: '#0E3470' };

                return (
                  <div
                    key={doc.id}
                    className="grid px-5 py-3.5 border-b border-[#EEF0F4] last:border-b-0 transition-all duration-200 group cursor-default"
                    style={{
                      gridTemplateColumns: '2.2fr 100px 70px 80px 130px 80px',
                      borderLeft: '3px solid transparent',
                      animation: `fadeUp 0.3s ease ${i * 0.04}s both`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderLeftColor = '#BC9C45';
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(253,248,237,0.4)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                      (e.currentTarget as HTMLElement).style.backgroundColor = '';
                    }}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[12px] transition-transform duration-200 group-hover:scale-110"
                        style={{ backgroundColor: `${fc.color}08`, border: `1px solid ${fc.color}15` }}
                      >
                        📄
                      </div>
                      <span className={`text-[12.5px] font-semibold truncate transition-colors duration-200 ${
                        canView ? 'text-[#0E3470] group-hover:text-[#1D5FB8]' : 'text-[#9CA3AF]'
                      }`}>
                        {doc.name}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="text-[11px] text-[#6B7280] tabular-nums flex items-center">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </div>

                    {/* Pages */}
                    <div className="text-[11px] text-[#4B5563] font-medium flex items-center">—</div>

                    {/* Size */}
                    <div className="text-[11px] text-[#6B7280] flex items-center">{formatFileSize(doc.file_size)}</div>

                    {/* Status */}
                    <div className="flex items-center">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold"
                        style={{ backgroundColor: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}18` }}
                      >
                        <span className="font-bold text-[11px]">{statusCfg.icon}</span>
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-end gap-1.5">
                      {canView && (
                        <button
                          onClick={() => {
                            onDocumentDownload(doc.id);
                            onViewDocument(`/api/documents/${doc.id}/download?view=true`, doc.name);
                          }}
                          className="px-3.5 py-1.5 rounded-md text-[11px] font-semibold border border-[#0E3470]/15 text-[#0E3470] group-hover:bg-[#0E3470] group-hover:text-white transition-all duration-200"
                        >
                          View
                        </button>
                      )}
                      {doc.is_downloadable && canView && (
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          onClick={() => onDocumentDownload(doc.id)}
                          className="px-2 py-1.5 rounded-md text-[11px] text-[#6B7280] hover:text-[#0E3470] transition-colors"
                          title="Download"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
