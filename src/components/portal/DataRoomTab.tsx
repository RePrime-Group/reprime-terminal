'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TerminalDDFolder, TerminalDDDocument, DataRoomFolderNode } from '@/lib/types/database';
import { FolderIcon, FileIcon } from '@/components/ui/DataRoomIcons';

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Tree construction ────────────────────────────────────────────────────────

function buildTree(
  folders: (TerminalDDFolder & { documents: TerminalDDDocument[] })[],
): DataRoomFolderNode[] {
  const nodeMap = new Map<string, DataRoomFolderNode>();
  for (const f of folders) {
    nodeMap.set(f.id, { ...f, children: [], documents: [...(f.documents ?? [])] });
  }
  const roots: DataRoomFolderNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortChildren = (n: DataRoomFolderNode) => {
    n.children.sort((a, b) => a.display_order - b.display_order);
    n.children.forEach(sortChildren);
    n.documents.sort((a, b) => a.sort_order - b.sort_order);
  };
  roots.sort((a, b) => a.display_order - b.display_order);
  roots.forEach(sortChildren);
  return roots;
}

function countUploadedDocs(node: DataRoomFolderNode): number {
  let n = node.documents.filter((d) => !!d.storage_path).length;
  for (const c of node.children) n += countUploadedDocs(c);
  return n;
}

function collectUploadedDocIds(node: DataRoomFolderNode): string[] {
  const ids = node.documents.filter((d) => !!d.storage_path).map((d) => d.id);
  for (const c of node.children) ids.push(...collectUploadedDocIds(c));
  return ids;
}

function allUploadedDocs(roots: DataRoomFolderNode[]): TerminalDDDocument[] {
  const out: TerminalDDDocument[] = [];
  const walk = (n: DataRoomFolderNode) => {
    for (const d of n.documents) if (d.storage_path) out.push(d);
    for (const c of n.children) walk(c);
  };
  roots.forEach(walk);
  return out;
}

// Breadcrumb path to a folder: "Leases → Five Star Grocery"
function pathLabelFor(roots: DataRoomFolderNode[], folderId: string): string {
  const walk = (nodes: DataRoomFolderNode[], trail: string[]): string[] | null => {
    for (const n of nodes) {
      const nextTrail = [...trail, n.name];
      if (n.id === folderId) return nextTrail;
      const found = walk(n.children, nextTrail);
      if (found) return found;
    }
    return null;
  };
  const trail = walk(roots, []);
  return (trail ?? []).join(' → ');
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DataRoomTab({
  folders, dealId, investorName, investorEmail,
  onViewDocument, onDocumentDownload,
}: DataRoomTabProps) {
  const t = useTranslations('portal.dataRoom');

  const tree = useMemo(() => buildTree(folders), [folders]);
  const uploadedDocs = useMemo(() => allUploadedDocs(tree), [tree]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFolderRecursive = (node: DataRoomFolderNode) => {
    const ids = collectUploadedDocIds(node);
    const allSelected = ids.length > 0 && ids.every((id) => selectedDocs.has(id));
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  };

  // Search hits across the whole tree with breadcrumb paths.
  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const hits: Array<{ doc: TerminalDDDocument; path: string }> = [];
    const walk = (nodes: DataRoomFolderNode[]) => {
      for (const n of nodes) {
        const path = pathLabelFor(tree, n.id);
        for (const d of n.documents) {
          if (!d.storage_path) continue;
          const name = (d.display_name ?? d.name).toLowerCase();
          if (name.includes(q)) hits.push({ doc: d, path });
        }
        walk(n.children);
      }
    };
    walk(tree);
    return hits;
  }, [searchQuery, tree]);

  function downloadSelected() {
    if (selectedDocs.size === 0) return;
    const ids = [...selectedDocs].join(',');
    window.location.href = `/api/deals/${dealId}/package?docs=${ids}`;
  }

  const hasSelection = selectedDocs.size > 0;

  return (
    <div>
      {/* Header: watermark label + download-all, compact single row */}
      <div className="px-4 md:px-6 pt-2 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-[12px] text-[#9CA3AF] truncate">
          {t('watermarked')}{' '}
          <span className="font-semibold text-[#0E3470]">{investorName}</span> · {investorEmail}
        </p>
        <a
          href={`/api/deals/${dealId}/package`}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#0F1B2D] text-white text-[12px] font-semibold hover:bg-[#1a2a42] transition-colors self-start sm:self-auto shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t('downloadAll')} ({uploadedDocs.length})
        </a>
      </div>

      {/* Search + bulk download */}
      <div className="px-4 md:px-6 pb-2 flex items-center gap-2">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-[8px] pl-9 pr-3 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#0F1B2D] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#C8A951]/20 focus:border-[#C8A951] transition-all"
          />
        </div>
        {hasSelection && (
          <button
            onClick={downloadSelected}
            className="py-[8px] px-3 rounded-lg bg-[#C8A951] text-[#0F1B2D] text-[12px] font-semibold whitespace-nowrap hover:bg-[#b89a42] transition-colors"
          >
            ⬇ {t('downloadSelected', { count: selectedDocs.size })}
          </button>
        )}
      </div>

      {/* Body: search results OR tree */}
      <div className="px-4 md:px-6 pb-4">
        {searchHits !== null ? (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-2">
            {searchHits.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#9CA3AF]">
                {t('noSearchResults')}
              </div>
            ) : (
              searchHits.map(({ doc, path }) => (
                <InvestorFileRow
                  key={doc.id}
                  doc={doc}
                  subpath={path}
                  isSelected={selectedDocs.has(doc.id)}
                  onToggleSelect={() => toggleDoc(doc.id)}
                  onView={onViewDocument}
                  onDownload={onDocumentDownload}
                />
              ))
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-2">
            {tree.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#9CA3AF]">
                {t('noDocumentsInCategory')}
              </div>
            ) : (
              tree.map((node) => (
                <InvestorFolderNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  selectedDocs={selectedDocs}
                  onToggleExpanded={toggleExpanded}
                  onToggleDoc={toggleDoc}
                  onToggleFolder={toggleFolderRecursive}
                  onViewDocument={onViewDocument}
                  onDocumentDownload={onDocumentDownload}
                />
              ))
            )}
          </div>
        )}

        {/* Footer — count on left, "Missing a document? Request from Team" inline on right */}
        <div className="mt-2 px-1 flex items-center justify-between gap-3 text-[12px] text-[#9CA3AF]">
          <span>
            {uploadedDocs.length} {t('document')}{uploadedDocs.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <span>{t('missingDocument')}</span>
            <a
              href="https://wa.me/19177030365?text=Hi, I need a document for the data room"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0F1B2D] font-semibold hover:text-[#BC9C45] underline-offset-2 hover:underline"
            >
              {t('requestFromTeam')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InvestorFolderNode({
  node,
  depth,
  expanded,
  selectedDocs,
  onToggleExpanded,
  onToggleDoc,
  onToggleFolder,
  onViewDocument,
  onDocumentDownload,
}: {
  node: DataRoomFolderNode;
  depth: number;
  expanded: Set<string>;
  selectedDocs: Set<string>;
  onToggleExpanded: (id: string) => void;
  onToggleDoc: (id: string) => void;
  onToggleFolder: (node: DataRoomFolderNode) => void;
  onViewDocument: (url: string, name: string, storagePath?: string) => void;
  onDocumentDownload: (docId: string) => void;
}) {
  const count = countUploadedDocs(node);
  // Hide empty folders in investor view (per spec §3A).
  if (count === 0) return null;

  const isExpanded = expanded.has(node.id);
  const allSubtreeIds = collectUploadedDocIds(node);
  const allSelected = allSubtreeIds.length > 0 && allSubtreeIds.every((id) => selectedDocs.has(id));
  const someSelected = !allSelected && allSubtreeIds.some((id) => selectedDocs.has(id));

  return (
    <div>
      <div
        onClick={() => onToggleExpanded(node.id)}
        className="flex items-center gap-2 py-2 pr-2 rounded-md cursor-pointer hover:bg-[#F3F4F6] transition-colors select-none"
      >
        <span style={{ paddingLeft: depth * 18 + 6 }} />
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleFolder(node)}
          className="w-3.5 h-3.5 accent-[#C8A951] shrink-0"
        />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpanded(node.id); }}
          className="w-4 h-4 flex items-center justify-center text-[#9CA3AF] shrink-0"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>
        <FolderIcon />
        <span className="flex-1 min-w-0 truncate text-[15px] font-medium text-[#0F1B2D]">
          {node.name}
        </span>
        <span className="text-[13px] text-[#9CA3AF] tabular-nums shrink-0">{count}</span>
      </div>

      {isExpanded && (
        <>
          {node.children.map((child) => (
            <InvestorFolderNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedDocs={selectedDocs}
              onToggleExpanded={onToggleExpanded}
              onToggleDoc={onToggleDoc}
              onToggleFolder={onToggleFolder}
              onViewDocument={onViewDocument}
              onDocumentDownload={onDocumentDownload}
            />
          ))}
          {node.documents
            .filter((d) => !!d.storage_path)
            .map((doc) => (
              <InvestorFileRow
                key={doc.id}
                doc={doc}
                depth={depth + 1}
                isSelected={selectedDocs.has(doc.id)}
                onToggleSelect={() => onToggleDoc(doc.id)}
                onView={onViewDocument}
                onDownload={onDocumentDownload}
              />
            ))}
        </>
      )}
    </div>
  );
}

function InvestorFileRow({
  doc,
  depth = 0,
  subpath,
  isSelected,
  onToggleSelect,
  onView,
  onDownload,
}: {
  doc: TerminalDDDocument;
  depth?: number;
  subpath?: string;
  isSelected: boolean;
  onToggleSelect: () => void;
  onView: (url: string, name: string, storagePath?: string) => void;
  onDownload: (docId: string) => void;
}) {
  const displayName = doc.display_name ?? doc.name;

  return (
    <div
      onClick={onToggleSelect}
      className={`group flex items-center gap-2 py-2 pr-2 rounded-md cursor-pointer transition-colors select-none ${
        isSelected ? 'bg-[rgba(200,169,81,0.1)]' : 'hover:bg-[#F9FAFB]'
      }`}
    >
      <span style={{ paddingLeft: depth * 18 + 6 }} />
      {/* Spacer matching the folder's chevron so the whole file row (checkbox
          included) sits past the parent folder row. */}
      <span className="w-4 shrink-0" aria-hidden />
      <input
        type="checkbox"
        checked={isSelected}
        onClick={(e) => e.stopPropagation()}
        onChange={onToggleSelect}
        className="w-3.5 h-3.5 accent-[#C8A951] shrink-0"
      />
      <FileIcon name={doc.display_name ?? doc.name} />
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(doc.id);
            onView(`/api/documents/${doc.id}/download?view=true`, displayName, doc.storage_path ?? undefined);
          }}
          className="block w-full text-start text-[15px] text-[#0F1B2D] truncate hover:text-[#BC9C45] hover:underline cursor-pointer"
        >
          {displayName}
        </button>
        {subpath && (
          <div className="text-[11px] text-[#9CA3AF] truncate">{subpath}</div>
        )}
        <div className="md:hidden mt-0.5 text-[11px] text-[#9CA3AF] truncate">
          {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)}
        </div>
      </div>
      <span className="hidden md:block w-16 text-right text-[12px] text-[#9CA3AF] shrink-0">
        {formatFileSize(doc.file_size)}
      </span>
      <span className="hidden md:block w-20 text-right text-[12px] text-[#9CA3AF] shrink-0">
        {formatDate(doc.created_at)}
      </span>
      <a
        href={`/api/documents/${doc.id}/download`}
        onClick={(e) => {
          e.stopPropagation();
          onDownload(doc.id);
        }}
        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-[#E5E7EB] flex items-center justify-center text-[#6B7280] shrink-0 transition-opacity"
        aria-label="Download"
        title="Download"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>
    </div>
  );
}
