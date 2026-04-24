'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { DataRoomFolderNode, TerminalDDDocument } from '@/lib/types/database';
import { useDataRoomContext } from './DataRoomContext';
import { countAllDocs } from '../_lib/tree';
import { FolderIcon, FileIcon } from '@/components/ui/DataRoomIcons';

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers — kept local so Nodes.tsx stays standalone.
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: string | number | null): string {
  const n = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (!n || isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FolderNode — recursive folder row + children
// ─────────────────────────────────────────────────────────────────────────────

export function FolderNode({
  node,
  depth,
}: {
  node: DataRoomFolderNode;
  depth: number;
}) {
  const ctx = useDataRoomContext();
  const isExpanded = ctx.expandedFolders.has(node.id);
  const isEditing = ctx.editingFolderId === node.id;
  const totalCount = countAllDocs(node);
  const isEmpty = totalCount === 0 && node.children.length === 0;

  // Folder is itself draggable (reorder / nest into others)
  const {
    setNodeRef: setDraggableRef,
    listeners,
    attributes,
    transform,
    isDragging,
  } = useDraggable({
    id: `folder:${node.id}`,
    data: { type: 'folder', folderId: node.id, parentId: node.parent_id },
    disabled: isEditing,
  });

  // Folder is also a drop target (accept files/folders dropped into it).
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `folder-drop:${node.id}`,
    data: { type: 'folder', folderId: node.id },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : undefined,
  };

  const highlightDrop = isOver && !isDragging;

  return (
    <div>
      <div
        ref={(el) => {
          setDraggableRef(el);
          setDroppableRef(el);
        }}
        style={style}
        {...listeners}
        {...attributes}
        onClick={() => ctx.toggleExpanded(node.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          ctx.onContextMenu(e.clientX, e.clientY, { type: 'folder', folderId: node.id });
        }}
        // Native HTML5 DnD — desktop file drops. Runs independently of dnd-kit
        // which is used only for in-app node drags.
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            ctx.onUploadFiles(node.id, e.dataTransfer.files);
            ctx.expandFolder(node.id);
          }
        }}
        className={`group flex items-center gap-2 py-2 pr-2 rounded-md cursor-pointer transition-colors select-none ${
          highlightDrop ? 'bg-rp-gold/10 ring-1 ring-rp-gold' : 'hover:bg-rp-gray-100'
        } ${isEmpty ? 'opacity-50' : ''}`}
      >
        <span style={{ paddingLeft: depth * 18 + 6 }} />

        {/* Chevron — only for folders that have children or docs */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            ctx.toggleExpanded(node.id);
          }}
          className="w-4 h-4 flex items-center justify-center text-rp-gray-400 hover:text-rp-navy shrink-0"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {node.children.length === 0 && node.documents.length === 0 ? (
            <span className="text-[10px]">·</span>
          ) : isExpanded ? (
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>

        <FolderIcon />

        <div className="flex-1 min-w-0 text-[15px] font-medium text-rp-gray-700 truncate">
          {isEditing ? (
            <InlineEdit
              initial={node.name}
              onCommit={(name) => {
                ctx.data.renameFolder(node.id, name);
                ctx.setEditingFolderId(null);
              }}
              onCancel={() => ctx.setEditingFolderId(null)}
            />
          ) : (
            <span onDoubleClick={(e) => { e.stopPropagation(); ctx.setEditingFolderId(node.id); }}>
              {node.name}
            </span>
          )}
        </div>

        <span className="text-[13px] text-rp-gray-400 shrink-0 tabular-nums">{totalCount}</span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            ctx.onContextMenu(e.clientX, e.clientY, { type: 'folder', folderId: node.id });
          }}
          className="w-6 h-6 rounded opacity-0 group-hover:opacity-100 hover:bg-rp-gray-200 flex items-center justify-center text-rp-gray-500 shrink-0"
          aria-label="Folder actions"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div>
          {node.children.map((child) => (
            <FolderNode key={child.id} node={child} depth={depth + 1} />
          ))}
          {node.documents.map((doc) => (
            <FileRow key={doc.id} doc={doc} depth={depth + 1} />
          ))}
          {/* Empty state inside an expanded folder — invites upload */}
          {node.children.length === 0 && node.documents.length === 0 && (
            <div
              style={{ paddingLeft: (depth + 1) * 18 + 32 }}
              className="text-xs text-rp-gray-400 py-2 italic"
            >
              Empty — right-click to add subfolder or drop files here
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FileRow — document row
// ─────────────────────────────────────────────────────────────────────────────

export function FileRow({
  doc,
  depth,
}: {
  doc: TerminalDDDocument;
  depth: number;
}) {
  const ctx = useDataRoomContext();
  const isEditing = ctx.editingDocId === doc.id;
  const isSelected = ctx.selection.isSelected(doc.id);

  const {
    setNodeRef,
    listeners,
    attributes,
    transform,
    isDragging,
  } = useDraggable({
    id: `doc:${doc.id}`,
    data: { type: 'document', docId: doc.id, folderId: doc.folder_id },
    disabled: isEditing,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : undefined,
  };

  const displayName = doc.display_name ?? doc.name;
  const hasFile = !!doc.storage_path;

  return (
    <div
      ref={(el) => setNodeRef(el)}
      style={style}
      {...listeners}
      {...attributes}
      onContextMenu={(e) => {
        e.preventDefault();
        ctx.onContextMenu(e.clientX, e.clientY, { type: 'document', docId: doc.id });
      }}
      className={`group flex items-center gap-2 py-2 pr-2 rounded-md cursor-pointer transition-colors select-none ${
        isSelected ? 'bg-rp-gold/10' : 'hover:bg-rp-gray-50'
      } ${!hasFile ? 'opacity-60' : ''}`}
    >
      <span style={{ paddingLeft: depth * 18 + 6 }} />

      <input
        type="checkbox"
        checked={isSelected}
        onClick={(e) => e.stopPropagation()}
        onChange={() => ctx.selection.toggleDoc(doc.id)}
        className="w-3.5 h-3.5 accent-rp-gold shrink-0"
      />

      <FileIcon name={doc.display_name ?? doc.name} />

      <div className="flex-1 min-w-0 text-[15px] text-rp-gray-700 truncate">
        {isEditing ? (
          <InlineEdit
            initial={displayName}
            onCommit={(name) => {
              ctx.data.renameDocument(doc.id, name);
              ctx.setEditingDocId(null);
            }}
            onCancel={() => ctx.setEditingDocId(null)}
          />
        ) : (
          <span onDoubleClick={(e) => { e.stopPropagation(); ctx.setEditingDocId(doc.id); }}>
            {displayName}
            {!hasFile && <span className="ml-2 text-[10px] text-rp-gray-400">(placeholder)</span>}
          </span>
        )}
      </div>

      <span className="hidden md:block w-16 text-right text-[12px] text-rp-gray-400 shrink-0">
        {formatFileSize(doc.file_size)}
      </span>
      <span className="hidden md:block w-20 text-right text-[12px] text-rp-gray-400 shrink-0">
        {formatDate(doc.created_at)}
      </span>

      {hasFile && (
        <a
          href={`/api/documents/${doc.id}/download`}
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-rp-gray-200 flex items-center justify-center text-rp-gray-500 shrink-0"
          aria-label="Download"
          title="Download"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          ctx.onRequestDeleteDoc(doc.id);
        }}
        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-red-50 flex items-center justify-center text-rp-gray-400 hover:text-red-600 shrink-0"
        aria-label="Delete"
        title="Delete"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineEdit — common rename input
// ─────────────────────────────────────────────────────────────────────────────

function InlineEdit({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed && trimmed !== initial) onCommit(trimmed);
      else onCancel();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    e.stopPropagation();
  }

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKey}
      onBlur={() => {
        const trimmed = value.trim();
        if (trimmed && trimmed !== initial) onCommit(trimmed);
        else onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="w-full px-2 py-0.5 text-sm border border-rp-gold rounded outline-none bg-white"
    />
  );
}
