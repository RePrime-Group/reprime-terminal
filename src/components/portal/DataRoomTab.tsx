'use client';

import { useState, useEffect, useRef } from 'react';
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
  onViewDocument: (url: string, name: string) => void;
  onDocumentDownload: (docId: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; rank: number }> = {
  verified:     { label: 'Verified',       color: '#0B8A4D', bg: '#ECFDF5', icon: '✓',  rank: 5 },
  uploaded:     { label: 'Uploaded',        color: '#1D5FB8', bg: '#EFF6FF', icon: '↑',  rank: 4 },
  pending:      { label: 'Pending Review',  color: '#D97706', bg: '#FFFBEB', icon: '◷',  rank: 3 },
  requested:    { label: 'Requested',       color: '#BC9C45', bg: '#FDF8ED', icon: '↗',  rank: 2 },
  notuploaded:  { label: 'Not Uploaded',    color: '#9CA3AF', bg: '#F7F8FA', icon: '○',  rank: 1 },
  doesnotexist: { label: 'Does Not Exist',  color: '#D1D5DB', bg: '#F7F8FA', icon: '—',  rank: 0 },
  na:           { label: 'N/A',            color: '#D1D5DB', bg: '#F7F8FA', icon: '—',  rank: 0 },
  notrequired:  { label: 'Not Required',   color: '#D1D5DB', bg: '#F7F8FA', icon: '—',  rank: 0 },
};

function getDocStatus(doc: TerminalDDDocument): string {
  if (doc.doc_status && doc.doc_status in STATUS_CONFIG) return doc.doc_status;
  if (doc.is_verified) return 'verified';
  if (doc.storage_path) return 'uploaded';
  return 'pending';
}

function getFolderColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('financial') || n.includes('fiscal')) return '#1D5FB8';
  if (n.includes('legal') || n.includes('lease')) return '#0E3470';
  if (n.includes('environment')) return '#0B8A4D';
  if (n.includes('property') || n.includes('condition') || n.includes('inspection')) return '#D97706';
  if (n.includes('tenant') || n.includes('investor')) return '#009080';
  if (n.includes('fire') || n.includes('safety')) return '#DC2626';
  if (n.includes('insurance')) return '#6B7280';
  if (n.includes('elevator') || n.includes('operation')) return '#D97706';
  if (n.includes('photo') || n.includes('plan') || n.includes('site')) return '#1D5FB8';
  if (n.includes('market') || n.includes('research') || n.includes('om') || n.includes('presentation')) return '#BC9C45';
  if (n.includes('financing') || n.includes('lender')) return '#0E3470';
  if (n.includes('post') || n.includes('closing')) return '#0B8A4D';
  return '#0E3470';
}

function formatFileSize(size: string | null): string {
  if (!size) return '—';
  const n = parseInt(size);
  if (isNaN(n)) return size;
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

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

function CountdownRing({ targetDate, label, size = 110 }: { targetDate: string | null; label: string; size?: number }) {
  const { days, hours, minutes, seconds, isExpired, totalMs } = useCountdown(targetDate);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, (totalMs / (30 * 86400000)) * 100);
  const offset = circ - (pct / 100) * circ;
  const color = isExpired ? '#9CA3AF' : days >= 14 ? '#0B8A4D' : days >= 7 ? '#D97706' : '#DC2626';

  if (!targetDate) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF0F4" strokeWidth={5} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.5s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-extrabold tabular-nums" style={{ color, lineHeight: 1 }}>
            {isExpired ? '0' : days}
          </span>
          <span className="text-[8px] font-semibold text-[#9CA3AF] uppercase tracking-[1px] mt-0.5">DAYS</span>
          {!isExpired && (
            <span className="text-[11px] font-semibold text-[#6B7280] tabular-nums mt-1">
              {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          )}
        </div>
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[1.5px]" style={{ color }}>{label}</span>
    </div>
  );
}

export default function DataRoomTab({
  folders, tasks, dealId, dealName, investorName, investorEmail,
  ddDeadline, closeDeadline, extensionDeadline,
  onViewDocument, onDocumentDownload,
}: DataRoomTabProps) {
  const [activeFolder, setActiveFolder] = useState(folders[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [activities, setActivities] = useState<{ action: string; created_at: string }[]>([]);
  const taskStats = { total: tasks.length, completed: tasks.filter(t => t.status === 'completed').length };

  useEffect(() => {
    const supabase = createClient();
    supabase.from('terminal_activity_log').select('action, created_at')
      .eq('deal_id', dealId).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setActivities(data ?? []));
  }, [dealId]);

  const allDocs = folders.flatMap((f) => f.documents);
  const total = allDocs.length;
  const statusCounts = {
    verified: allDocs.filter((d) => getDocStatus(d) === 'verified').length,
    uploaded: allDocs.filter((d) => getDocStatus(d) === 'uploaded').length,
    pending: allDocs.filter((d) => getDocStatus(d) === 'pending').length,
    requested: allDocs.filter((d) => getDocStatus(d) === 'requested').length,
    notuploaded: allDocs.filter((d) => getDocStatus(d) === 'notuploaded').length,
  };
  // Combined progress: documents + pipeline tasks
  const combinedTotal = total + taskStats.total;
  const combinedComplete = statusCounts.verified + statusCounts.uploaded + taskStats.completed;
  const completePct = combinedTotal > 0 ? Math.round((combinedComplete / combinedTotal) * 100) : 0;

  const activeFolderData = folders.find((f) => f.id === activeFolder);
  const filteredDocs = activeFolderData?.documents.filter(
    (d) => !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const actLabels: Record<string, string> = {
    deal_viewed: 'Deal viewed', document_downloaded: 'Document downloaded', om_downloaded: 'OM downloaded',
    dataroom_viewed: 'Data room accessed', meeting_requested: 'Meeting scheduled',
    expressed_interest: 'Interest expressed', irr_calculator_used: 'Returns modeled',
  };

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div>
      {/* Watermark notice */}
      <div className="bg-gradient-to-r from-[#FDF8ED] to-[#FBF3DC] border-b border-[#ECD9A0]/25 px-5 py-2.5 rounded-t-xl flex items-center gap-2.5 text-[11px]">
        <span className="text-[12px]">🔒</span>
        <span className="font-semibold text-[#0E3470]">View-only.</span>
        <span className="text-[#4B5563]">Watermarked: <strong className="text-[#0E3470]">{investorName}</strong> · {investorEmail} · Downloads disabled.</span>
      </div>

      {/* Deal Timeline */}
      <div className="bg-white border-b border-[#EEF0F4] px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold text-[#0E3470] uppercase tracking-[1.5px]">Deal Timeline</span>
        </div>
        <div className="flex justify-around items-center">
          <CountdownRing targetDate={ddDeadline} label="DD Expiration" />
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-[2px] bg-gradient-to-r from-[#BC9C45] to-[#EEF0F4]" />
            <span className="text-[7px] text-[#9CA3AF] font-semibold uppercase tracking-[1px]">then</span>
            <div className="w-12 h-[2px] bg-gradient-to-r from-[#EEF0F4] to-[#BC9C45]" />
          </div>
          <CountdownRing targetDate={closeDeadline} label="Closing" />
          {extensionDeadline && (
            <>
              <div className="flex flex-col items-center gap-1">
                <div className="w-12 h-[2px] bg-gradient-to-r from-[#BC9C45] to-[#EEF0F4]" />
                <span className="text-[7px] text-[#9CA3AF] font-semibold uppercase tracking-[1px]">option</span>
                <div className="w-12 h-[2px] bg-gradient-to-r from-[#EEF0F4] to-[#BC9C45]" />
              </div>
              <CountdownRing targetDate={extensionDeadline} label="Extension" />
            </>
          )}
        </div>
      </div>

      {/* Summary panel */}
      <div className="bg-white border-b border-[#EEF0F4] px-6 py-4">
        <div className="grid grid-cols-[auto_1fr_auto] gap-5 items-center">
          {/* Progress ring */}
          <div className="flex items-center gap-4">
            <div className="relative w-[70px] h-[70px]">
              <svg width="70" height="70" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="35" cy="35" r="27" fill="none" stroke="#EEF0F4" strokeWidth={5} />
                <circle cx="35" cy="35" r="27" fill="none"
                  stroke={completePct >= 80 ? '#0B8A4D' : completePct >= 50 ? '#BC9C45' : '#D97706'}
                  strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 27}
                  strokeDashoffset={2 * Math.PI * 27 * (1 - completePct / 100)}
                  style={{ transition: 'stroke-dashoffset 1.5s ease' }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[16px] font-bold text-[#0E3470] tabular-nums"><AnimNum target={completePct} />%</span>
              </div>
            </div>
            <div>
              <div className="text-[8px] font-bold text-[#0E3470] uppercase tracking-[1.5px]">Diligence Progress</div>
              <div className="text-[17px] font-extrabold text-[#0E3470] mt-0.5">
                {combinedComplete} <span className="text-[11px] font-normal text-[#9CA3AF]">of {combinedTotal}</span>
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {[
                  { l: 'Tasks Done', c: '#0B8A4D', n: taskStats.completed },
                  { l: 'Tasks Remaining', c: '#D97706', n: taskStats.total - taskStats.completed },
                  { l: 'Docs Verified', c: '#0B8A4D', n: statusCounts.verified },
                  { l: 'Docs Uploaded', c: '#1D5FB8', n: statusCounts.uploaded },
                  { l: 'Docs Pending', c: '#D97706', n: statusCounts.pending },
                ].filter((s) => s.n > 0).map((s) => (
                  <div key={s.l} className="flex items-center gap-1">
                    <div className="w-[5px] h-[5px] rounded-sm" style={{ backgroundColor: s.c }} />
                    <span className="text-[8px] font-semibold text-[#6B7280]">{s.n} {s.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status heatmap */}
          <div className="px-4 border-l border-r border-[#EEF0F4]">
            <div className="text-[7px] font-bold text-[#9CA3AF] uppercase tracking-[1.5px] mb-1.5">Status Map</div>
            <div className="flex gap-[2px] flex-wrap">
              {allDocs.map((d, i) => {
                const st = getDocStatus(d);
                const cfg = STATUS_CONFIG[st];
                return (
                  <div
                    key={i}
                    className="w-[9px] h-[9px] rounded-sm transition-all"
                    style={{ backgroundColor: cfg?.color ?? '#D1D5DB' }}
                    title={`${d.name} — ${cfg?.label}`}
                  />
                );
              })}
            </div>
            <div className="flex gap-2 mt-1.5">
              {[
                { c: '#0B8A4D', l: '✓' }, { c: '#1D5FB8', l: '↑' }, { c: '#D97706', l: '◷' },
                { c: '#BC9C45', l: '↗' }, { c: '#9CA3AF', l: '○' }, { c: '#D1D5DB', l: '—' },
              ].map((s) => (
                <div key={s.l} className="flex items-center gap-1">
                  <div className="w-[6px] h-[6px] rounded-sm" style={{ backgroundColor: s.c }} />
                  <span className="text-[7px] text-[#9CA3AF]">{s.l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Download buttons */}
          <div className="flex flex-col gap-1.5">
            <a href={`/api/deals/${dealId}/package`}
              className="px-4 py-1.5 rounded-md bg-[#0E3470] text-white text-[9px] font-bold text-center hover:opacity-90 transition-opacity">
              ⬇ Download All ({total})
            </a>
            <button className="px-4 py-1.5 rounded-md border border-[#EEF0F4] bg-white text-[#0E3470] text-[9px] font-bold">
              ✓ Verified Only ({statusCounts.verified})
            </button>
            <button className="px-4 py-1.5 rounded-md border border-[#BC9C45]/30 bg-[#FDF8ED] text-[#0E3470] text-[9px] font-bold">
              📋 DD Checklist
            </button>
          </div>
        </div>
      </div>

      {/* 3-column layout: sidebar + table + activity */}
      <div className="grid grid-cols-[210px_1fr_200px] gap-0 bg-white rounded-b-xl border border-[#EEF0F4] border-t-0 overflow-hidden" style={{ minHeight: 460 }}>
        {/* Dark sidebar */}
        <div className="shrink-0 overflow-y-auto" style={{ background: 'linear-gradient(180deg, #0A1628 0%, #091e3f 100%)', maxHeight: 460 }}>
          <div className="px-3 pt-2 pb-1 border-b border-white/[0.05]">
            <span className="text-[7px] font-bold text-[#BC9C45] uppercase tracking-[2px]">Categories</span>
          </div>
          <div className="p-1.5">
            {folders.map((folder) => {
              const fc = getFolderColor(folder.name);
              const folderDocs = folder.documents;
              const fVerified = folderDocs.filter((d) => getDocStatus(d) === 'verified' || getDocStatus(d) === 'uploaded').length;
              const fTotal = folderDocs.length;
              const pct = fTotal > 0 ? Math.round((fVerified / fTotal) * 100) : 0;
              const isActive = activeFolder === folder.id;

              return (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-md mb-0.5 transition-all ${
                    isActive ? 'bg-[#BC9C45]/10 border-l-[3px] border-l-[#BC9C45]' : 'border-l-[3px] border-l-transparent hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] w-[18px] text-center">{folder.icon || '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className={`text-[9px] truncate ${isActive ? 'font-bold text-white' : 'font-medium text-white/50'}`}>
                          {folder.name.replace(/^\d+_/, '').replace(/_/g, ' ')}
                        </span>
                        {fTotal > 0 && (
                          <span className={`text-[7px] font-bold ${isActive ? 'text-[#BC9C45]' : 'text-white/20'}`}>{fTotal}</span>
                        )}
                      </div>
                      {fTotal > 0 && (
                        <div className="h-[2px] bg-white/[0.08] rounded-full mt-1 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: isActive ? '#BC9C45' : 'rgba(255,255,255,0.15)' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Document table */}
        <div className="min-w-0 border-r border-[#EEF0F4]">
          <div className="px-4 py-3 border-b border-[#EEF0F4] flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-[#0E3470] font-[family-name:var(--font-playfair)]">
                {activeFolderData?.name.replace(/^\d+_/, '').replace(/_/g, ' ') || 'Documents'}
              </h3>
              <span className="text-[9px] text-[#9CA3AF]">{filteredDocs.length} documents</span>
            </div>
            <div className="relative">
              <input
                type="text" placeholder="Search..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-[10px] border border-[#EEF0F4] rounded-md w-[180px] focus:outline-none focus:ring-[2px] focus:ring-[#BC9C45]/15 focus:border-[#BC9C45]"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#9CA3AF]">🔍</span>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid px-4 py-2 bg-[#FAFBFC] border-b border-[#EEF0F4]" style={{ gridTemplateColumns: '2.8fr 70px 55px 95px 50px' }}>
            {['Document', 'Owner', 'Day', 'Status', ''].map((h) => (
              <div key={h} className="text-[7px] font-bold text-[#9CA3AF] uppercase tracking-[1.5px]">{h}</div>
            ))}
          </div>

          {/* Rows */}
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {filteredDocs.length === 0 ? (
              <div className="text-center py-12 text-[11px] text-[#9CA3AF]">No documents in this folder</div>
            ) : (
              filteredDocs.map((doc, i) => {
                const status = getDocStatus(doc);
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
                const canView = ['verified', 'uploaded', 'pending'].includes(status);

                return (
                  <div
                    key={doc.id}
                    className="grid px-4 py-2.5 border-b border-[#EEF0F4] last:border-b-0 transition-all duration-150 group"
                    style={{
                      gridTemplateColumns: '2.8fr 70px 55px 95px 50px',
                      borderLeft: '3px solid transparent',
                      animation: `fadeUp 0.25s ease ${i * 0.03}s both`,
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
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] shrink-0">📄</span>
                      <div className="min-w-0">
                        <div className={`text-[10.5px] font-semibold truncate ${canView ? 'text-[#0E3470] group-hover:text-[#1D5FB8]' : 'text-[#9CA3AF]'} transition-colors`}>
                          {doc.name}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] text-[#6B7280] flex items-center">—</span>
                    <span className="text-[9px] text-[#6B7280] flex items-center">—</span>
                    <div className="flex items-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-semibold"
                        style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}15` }}>
                        <span className="font-bold">{cfg.icon}</span> {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-end">
                      {canView && (
                        <button
                          onClick={() => {
                            onDocumentDownload(doc.id);
                            onViewDocument(`/api/documents/${doc.id}/download?view=true`, doc.name);
                          }}
                          className="px-2 py-1 rounded text-[8px] font-semibold border border-[#0E3470]/12 text-[#0E3470] group-hover:bg-[#0E3470] group-hover:text-white transition-all"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-4 py-2 border-t border-[#EEF0F4] bg-[#FAFBFC] text-[8px] text-[#9CA3AF] flex justify-between">
            <span>{filteredDocs.length} docs · {total} total items</span>
            <span>{now}</span>
          </div>
        </div>

        {/* Activity panel */}
        <div className="bg-[#FAFBFC] p-3 overflow-y-auto" style={{ maxHeight: 460 }}>
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-1 h-1 rounded-full bg-[#0B8A4D] live-dot" />
            <span className="text-[8px] font-bold text-[#0E3470] uppercase tracking-[1px]">Activity</span>
          </div>
          {activities.length === 0 ? (
            <p className="text-[9px] text-[#9CA3AF]">No activity yet</p>
          ) : (
            activities.map((a, i) => (
              <div key={i} className="flex gap-2 py-2 border-b border-[#EEF0F4] last:border-b-0">
                <div className="w-1 h-1 rounded-full bg-[#BC9C45] mt-1.5 shrink-0" />
                <div>
                  <div className="text-[9px] text-[#374151] leading-tight">{actLabels[a.action] ?? a.action}</div>
                  <div className="text-[8px] text-[#9CA3AF] mt-0.5">{timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))
          )}

          {/* Missing document request */}
          <div className="mt-4 p-3 bg-[#FDF8ED] border border-[#ECD9A0]/30 rounded-lg">
            <div className="text-[9px] font-bold text-[#0E3470] mb-1">Missing a document?</div>
            <div className="text-[8px] text-[#6B7280] mb-2">Request from our team and we'll source it from the seller.</div>
            <a href="https://wa.me/19177030365?text=Hi, I need a document for the data room"
              target="_blank" rel="noopener noreferrer"
              className="block text-center py-1.5 rounded-md bg-[#BC9C45] text-white text-[9px] font-bold hover:opacity-90 transition-opacity">
              Request from Team
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
