'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { ACCEPTED_DOC_TYPES, MAX_DOC_SIZE } from '@/lib/constants';
import DealSubNav from '@/components/admin/DealSubNav';

// ── Types ────────────────────────────────────────────────────────────────────

interface DDFolder {
  id: string;
  deal_id: string;
  name: string;
  icon: string;
  display_order: number;
  created_at: string;
}

interface DDDocument {
  id: string;
  deal_id: string;
  folder_id: string;
  name: string;
  file_size: string | null;
  file_type: string | null;
  storage_path: string | null;
  is_verified: boolean;
  doc_status: string;
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const FOLDER_EMOJIS = [
  '\u{1F4C1}', '\u{1F4CA}', '\u{1F4CB}', '\u{1F4D1}', '\u{1F4BC}',
  '\u{1F3E2}', '\u{1F4C8}', '\u{1F4C9}', '\u{1F511}', '\u{1F4B0}',
  '\u{1F4E6}', '\u{1F3D7}\uFE0F',
] as const;

const MIME_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/zip': 'ZIP',
};

const FILE_ICON: Record<string, string> = {
  'application/pdf': '\u{1F4D5}',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '\u{1F4D7}',
  'application/zip': '\u{1F4E6}',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fileIconFor(mime: string): string {
  return FILE_ICON[mime] ?? '\u{1F4C4}';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DataRoomPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;
  const locale = (params.locale as string) ?? 'en';

  const supabase = createClient();

  // ── Core state ─────────────────────────────────────────────────────────────

  const [dealName, setDealName] = useState('');
  const [folders, setFolders] = useState<DDFolder[]>([]);
  const [documents, setDocuments] = useState<DDDocument[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Folder form state ──────────────────────────────────────────────────────

  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState<string>(FOLDER_EMOJIS[0]);
  const [savingFolder, setSavingFolder] = useState(false);

  // ── Delete confirmation state ──────────────────────────────────────────────

  const [deleteFolderTarget, setDeleteFolderTarget] = useState<DDFolder | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<DDDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Upload state ───────────────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [showZipModal, setShowZipModal] = useState(false);
  const [pendingZipPath, setPendingZipPath] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<{ foldersCreated: number; filesExtracted: number; errors: string[]; classifications?: { fileName: string; category: string; confidence: string }[] } | null>(null);

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    const [dealRes, foldersRes, docsRes] = await Promise.all([
      supabase.from('terminal_deals').select('name').eq('id', dealId).single(),
      supabase
        .from('terminal_dd_folders')
        .select('*')
        .eq('deal_id', dealId)
        .order('display_order', { ascending: true }),
      supabase
        .from('terminal_dd_documents')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
    ]);

    if (dealRes.data) setDealName(dealRes.data.name as string);
    if (foldersRes.data) {
      const f = foldersRes.data as DDFolder[];
      setFolders(f);
      if (f.length > 0 && !selectedFolderId) {
        setSelectedFolderId(f[0].id);
      }
    }
    if (docsRes.data) setDocuments(docsRes.data as DDDocument[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Folder actions ─────────────────────────────────────────────────────────

  async function handleAddFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setSavingFolder(true);

    const nextOrder = folders.length > 0 ? Math.max(...folders.map((f) => f.display_order)) + 1 : 0;

    const { data, error } = await supabase
      .from('terminal_dd_folders')
      .insert({
        deal_id: dealId,
        name: trimmed,
        icon: newFolderIcon,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (!error && data) {
      const folder = data as DDFolder;
      setFolders((prev) => [...prev, folder]);
      if (!selectedFolderId) setSelectedFolderId(folder.id);
      setNewFolderName('');
      setNewFolderIcon(FOLDER_EMOJIS[0]);
      setShowAddFolder(false);
    }

    setSavingFolder(false);
  }

  async function handleDeleteFolder() {
    if (!deleteFolderTarget) return;
    setDeleting(true);

    // Delete documents in folder from storage first
    const folderDocs = documents.filter((d) => d.folder_id === deleteFolderTarget.id);
    if (folderDocs.length > 0) {
      await supabase.storage
        .from('terminal-dd-documents')
        .remove(folderDocs.map((d) => d.storage_path).filter((p): p is string => !!p));

      await supabase
        .from('terminal_dd_documents')
        .delete()
        .eq('folder_id', deleteFolderTarget.id);
    }

    await supabase.from('terminal_dd_folders').delete().eq('id', deleteFolderTarget.id);

    setFolders((prev) => prev.filter((f) => f.id !== deleteFolderTarget.id));
    setDocuments((prev) => prev.filter((d) => d.folder_id !== deleteFolderTarget.id));

    if (selectedFolderId === deleteFolderTarget.id) {
      const remaining = folders.filter((f) => f.id !== deleteFolderTarget.id);
      setSelectedFolderId(remaining.length > 0 ? remaining[0].id : null);
    }

    setDeleteFolderTarget(null);
    setDeleting(false);
  }

  async function handleReorderFolder(folderId: string, direction: 'up' | 'down') {
    const idx = folders.findIndex((f) => f.id === folderId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= folders.length) return;

    const updated = [...folders];
    const tempOrder = updated[idx].display_order;
    updated[idx] = { ...updated[idx], display_order: updated[swapIdx].display_order };
    updated[swapIdx] = { ...updated[swapIdx], display_order: tempOrder };
    updated.sort((a, b) => a.display_order - b.display_order);
    setFolders(updated);

    await Promise.all([
      supabase
        .from('terminal_dd_folders')
        .update({ display_order: updated[idx].display_order })
        .eq('id', updated[idx].id),
      supabase
        .from('terminal_dd_folders')
        .update({ display_order: updated[swapIdx].display_order })
        .eq('id', updated[swapIdx].id),
    ]);
  }

  // ── Upload actions ─────────────────────────────────────────────────────────

  async function handleFileSelect(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !selectedFolderId) return;
    const file = fileList[0];

    setUploadError('');

    // Check by MIME type OR file extension
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const acceptedExtensions = ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'zip', 'csv', 'txt', 'jpg', 'jpeg', 'png'];
    if (!ACCEPTED_DOC_TYPES.includes(file.type) && !acceptedExtensions.includes(ext)) {
      setUploadError(`Unsupported file type (${file.type || ext}). Accepted: PDF, XLSX, DOCX, ZIP, images.`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const storagePath = `${dealId}/${selectedFolderId}/${file.name}`;

    // Simulate incremental progress since Supabase JS doesn't expose upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
    }, 200);

    const { error: storageError } = await supabase.storage
      .from('terminal-dd-documents')
      .upload(storagePath, file, { upsert: true });

    clearInterval(progressInterval);

    if (storageError) {
      const sizeMsg = file.size > 50 * 1024 * 1024
        ? ` Your file is ${(file.size / 1024 / 1024).toFixed(0)}MB. Try splitting large ZIPs into smaller parts, or upload files individually.`
        : '';
      setUploadError(`Upload failed: ${storageError.message}${sizeMsg}`);
      setUploading(false);
      setUploadProgress(0);
      return;
    }

    setUploadProgress(95);

    const { data: insertedDoc, error: insertError } = await supabase
      .from('terminal_dd_documents')
      .insert({
        deal_id: dealId,
        folder_id: selectedFolderId,
        name: file.name,
        file_size: String(file.size),
        file_type: file.type,
        storage_path: storagePath,
        is_verified: false,
      })
      .select()
      .single();

    if (insertError) {
      setUploadError(`Failed to save document record: ${insertError.message}`);
    } else if (insertedDoc) {
      setDocuments((prev) => [insertedDoc as DDDocument, ...prev]);
    }

    setUploadProgress(100);
    setTimeout(() => {
      setUploading(false);
      setUploadProgress(0);
    }, 600);

    // If this is a ZIP file, offer extraction
    if (file.type === 'application/zip') {
      setPendingZipPath(storagePath);
      setShowZipModal(true);
    }

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleExtractZip() {
    if (!pendingZipPath) return;
    setExtracting(true);
    setExtractResult(null);

    try {
      const res = await fetch('/api/documents/extract-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, storagePath: pendingZipPath }),
      });
      const data = await res.json();

      if (res.ok) {
        setExtractResult(data);
        fetchData();
      } else {
        setUploadError(data.error || 'ZIP extraction failed');
      }
    } catch {
      setUploadError('Network error during ZIP extraction');
    } finally {
      setExtracting(false);
    }
  }

  async function handleAIClassify() {
    if (!pendingZipPath) return;
    setExtracting(true);
    setExtractResult(null);

    try {
      const res = await fetch('/api/documents/ai-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, storagePath: pendingZipPath }),
      });
      const data = await res.json();

      if (res.ok) {
        setExtractResult({
          foldersCreated: data.foldersCreated,
          filesExtracted: data.filesUploaded,
          errors: data.errors,
          classifications: data.classifications,
        });
        fetchData();
      } else {
        setUploadError(data.error || 'AI classification failed');
      }
    } catch {
      setUploadError('Network error during AI classification');
    } finally {
      setExtracting(false);
    }
  }

  // ── Document actions ───────────────────────────────────────────────────────

  async function handleToggleVerified(doc: DDDocument) {
    const newValue = !doc.is_verified;
    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, is_verified: newValue } : d)),
    );
    await supabase
      .from('terminal_dd_documents')
      .update({ is_verified: newValue })
      .eq('id', doc.id);
  }

  async function handleDeleteDocument() {
    if (!deleteDocTarget) return;
    setDeleting(true);

    await supabase.storage
      .from('terminal-dd-documents')
      .remove(deleteDocTarget.storage_path ? [deleteDocTarget.storage_path] : []);

    await supabase.from('terminal_dd_documents').delete().eq('id', deleteDocTarget.id);

    setDocuments((prev) => prev.filter((d) => d.id !== deleteDocTarget.id));
    setDeleteDocTarget(null);
    setDeleting(false);
  }

  function handleDownload(doc: DDDocument) {
    const { data } = supabase.storage
      .from('terminal-dd-documents')
      .getPublicUrl(doc.storage_path);
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank');
    }
  }

  // ── Drag & Drop helpers ────────────────────────────────────────────────────

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const folderDocCounts: Record<string, number> = {};
  for (const doc of documents) {
    folderDocCounts[doc.folder_id] = (folderDocCounts[doc.folder_id] ?? 0) + 1;
  }

  const visibleDocs = documents.filter((d) => d.folder_id === selectedFolderId);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-rp-gray-400 text-sm">Loading data room...</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Navigation tabs */}
      <DealSubNav dealId={dealId} dealName={dealName || 'Deal'} locale={locale} />

      {/* Populate button */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[18px] font-semibold text-rp-navy">Documents & Folders</h2>
        <button
          onClick={async () => {
            const res = await fetch(`/api/deals/${dealId}/populate-dd`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
            const data = await res.json();
            if (res.ok) {
              alert(`DD Checklist populated: ${data.docsCreated} documents added from ${data.propertyType} template`);
              fetchData();
            } else {
              alert(data.error || 'Failed to populate');
            }
          }}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-[12px] font-semibold hover:opacity-90 transition-opacity"
        >
          ⚡ Populate DD Checklist
        </button>
      </div>

      {/* Two-panel layout */}

      <div className="flex gap-6">
        {/* ─── Left Panel: Folders ─────────────────────────────────────── */}
        <div className="w-72 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-rp-gray-700 uppercase tracking-wider">
              Folders
            </h2>
            <Button
              variant="gold"
              size="sm"
              onClick={() => {
                setShowAddFolder(true);
                setNewFolderName('');
                setNewFolderIcon(FOLDER_EMOJIS[0]);
              }}
            >
              + Add Folder
            </Button>
          </div>

          {/* Add folder inline form */}
          {showAddFolder && (
            <div className="bg-white border border-rp-gray-200 rounded-xl p-3 mb-3 shadow-sm">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full rounded-lg border border-rp-gray-300 px-3 py-2 text-sm text-rp-gray-700 placeholder:text-rp-gray-400 outline-none focus:border-rp-gold transition-colors mb-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddFolder();
                  if (e.key === 'Escape') setShowAddFolder(false);
                }}
              />

              {/* Emoji picker */}
              <div className="grid grid-cols-6 gap-1 mb-3">
                {FOLDER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewFolderIcon(emoji)}
                    className={`text-lg p-1 rounded-md transition-colors ${
                      newFolderIcon === emoji
                        ? 'bg-rp-gold/20 ring-1 ring-rp-gold'
                        : 'hover:bg-rp-gray-100'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleAddFolder}
                  loading={savingFolder}
                  disabled={!newFolderName.trim()}
                >
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddFolder(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Folder list */}
          <div className="flex flex-col gap-1">
            {folders.map((folder, idx) => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  selectedFolderId === folder.id
                    ? 'bg-rp-gold/10 border-l-[3px] border-l-rp-gold'
                    : 'hover:bg-rp-gray-100 border-l-[3px] border-l-transparent'
                }`}
              >
                <span className="text-base shrink-0">{folder.icon}</span>
                <span className="text-sm font-medium text-rp-gray-700 truncate flex-1">
                  {folder.name}
                </span>
                <span className="text-xs text-rp-gray-400 shrink-0">
                  {folderDocCounts[folder.id] ?? 0}
                </span>

                {/* Reorder buttons */}
                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorderFolder(folder.id, 'up');
                    }}
                    disabled={idx === 0}
                    className="text-rp-gray-400 hover:text-rp-navy disabled:opacity-30 leading-none text-[10px]"
                    aria-label="Move folder up"
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorderFolder(folder.id, 'down');
                    }}
                    disabled={idx === folders.length - 1}
                    className="text-rp-gray-400 hover:text-rp-navy disabled:opacity-30 leading-none text-[10px]"
                    aria-label="Move folder down"
                  >
                    &#9660;
                  </button>
                </div>

                {/* Delete folder */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteFolderTarget(folder);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-rp-gray-400 hover:text-rp-red shrink-0"
                  aria-label="Delete folder"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}

            {folders.length === 0 && !showAddFolder && (
              <p className="text-rp-gray-400 text-sm text-center py-6">
                No folders yet. Add one to get started.
              </p>
            )}
          </div>
        </div>

        {/* ─── Right Panel: Documents ─────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {selectedFolderId ? (
            <>
              {/* Upload drop zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-rp-gray-300 rounded-xl p-8 mb-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-rp-gold/60 hover:bg-rp-gold/5 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ACCEPTED_DOC_TYPES.join(',')}
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-rp-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-sm text-rp-gray-500">
                  Drag &amp; drop files or{' '}
                  <span className="text-rp-gold font-semibold">click to browse</span>
                </p>
                <p className="text-xs text-rp-gray-400">
                  PDF, XLSX, DOCX, ZIP &middot; Max 50 MB
                </p>
              </div>

              {/* Upload progress / error */}
              {uploading && (
                <div className="mb-4 rounded-lg bg-rp-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-rp-gray-600">Uploading...</span>
                    <span className="text-rp-gold font-semibold">{uploadProgress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-rp-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-rp-gold rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {uploadError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {uploadError}
                </div>
              )}

              {/* Document list */}
              {visibleDocs.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {visibleDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white rounded-xl border border-rp-gray-200 px-4 py-3 flex items-center gap-4 shadow-sm"
                    >
                      {/* File icon */}
                      <span className="text-xl shrink-0">{fileIconFor(doc.file_type)}</span>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-rp-gray-700 truncate">
                          {doc.name}
                        </p>
                        <p className="text-xs text-rp-gray-400">
                          {MIME_LABEL[doc.file_type] ?? 'File'} &middot;{' '}
                          {formatFileSize(doc.file_size)} &middot;{' '}
                          {formatDate(doc.created_at)}
                        </p>
                      </div>

                      {/* Verified toggle */}
                      <button
                        onClick={() => handleToggleVerified(doc)}
                        className={`shrink-0 flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 transition-colors ${
                          doc.is_verified
                            ? 'bg-rp-green/10 text-rp-green'
                            : 'bg-rp-gray-100 text-rp-gray-400'
                        }`}
                        title={doc.is_verified ? 'Verified' : 'Pending verification'}
                      >
                        {doc.is_verified ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                        {doc.is_verified ? 'Verified' : 'Pending'}
                      </button>

                      {/* Download */}
                      <button
                        onClick={() => handleDownload(doc)}
                        className="shrink-0 text-rp-gray-400 hover:text-rp-navy transition-colors"
                        aria-label="Download document"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4.5 w-4.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteDocTarget(doc)}
                        className="shrink-0 text-rp-gray-400 hover:text-rp-red transition-colors"
                        aria-label="Delete document"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4.5 w-4.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-rp-gray-400 text-sm">No documents in this folder</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-rp-gray-400 text-sm">
                {folders.length === 0
                  ? 'Create a folder to start uploading documents.'
                  : 'Select a folder to view its documents.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Delete Folder Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={!!deleteFolderTarget}
        onClose={() => setDeleteFolderTarget(null)}
        title="Delete Folder"
      >
        <p className="text-sm text-rp-gray-600 mb-1">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-rp-navy">
            {deleteFolderTarget?.icon} {deleteFolderTarget?.name}
          </span>
          ?
        </p>
        <p className="text-xs text-rp-gray-400 mb-6">
          All {folderDocCounts[deleteFolderTarget?.id ?? ''] ?? 0} document(s) in this folder
          will be permanently removed.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteFolderTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteFolder} loading={deleting}>
            Delete Folder
          </Button>
        </div>
      </Modal>

      {/* ─── Delete Document Modal ────────────────────────────────────── */}
      <Modal
        isOpen={!!deleteDocTarget}
        onClose={() => setDeleteDocTarget(null)}
        title="Delete Document"
      >
        <p className="text-sm text-rp-gray-600 mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-rp-navy">{deleteDocTarget?.name}</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteDocTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteDocument} loading={deleting}>
            Delete Document
          </Button>
        </div>
      </Modal>

      {/* ─── ZIP Extraction Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={showZipModal}
        onClose={() => { setShowZipModal(false); setPendingZipPath(null); setExtractResult(null); }}
        title="Extract ZIP Contents"
      >
        {extractResult ? (
          <div>
            <div className="mb-3 p-3 bg-rp-green-light border border-rp-green-border rounded-lg">
              <p className="text-sm font-medium text-rp-green">
                {extractResult.classifications ? 'AI Classification Complete' : 'Extraction Complete'}
              </p>
              <p className="text-xs text-rp-green/70 mt-1">
                {extractResult.foldersCreated} folders created, {extractResult.filesExtracted} files organized
              </p>
            </div>
            {extractResult.classifications && (
              <div className="mb-3 max-h-[200px] overflow-y-auto">
                <p className="text-xs font-medium text-rp-navy mb-2">AI Classification Results:</p>
                {extractResult.classifications.map((c: { fileName: string; category: string; confidence: string }, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1 px-2 text-xs rounded hover:bg-rp-gray-100">
                    <span className="text-rp-gray-600 truncate flex-1">{c.fileName}</span>
                    <span className="text-rp-navy font-medium ml-2 shrink-0">{c.category}</span>
                    <span className={`ml-2 text-[9px] font-bold uppercase shrink-0 ${
                      c.confidence === 'high' ? 'text-rp-green' : c.confidence === 'medium' ? 'text-rp-amber' : 'text-rp-gray-400'
                    }`}>{c.confidence}</span>
                  </div>
                ))}
              </div>
            )}
            {extractResult.errors.length > 0 && (
              <div className="mb-3 p-3 bg-rp-amber-light border border-rp-amber-border rounded-lg">
                <p className="text-xs text-rp-amber font-medium">Some files had issues:</p>
                <ul className="text-xs text-rp-amber/70 mt-1 list-disc list-inside">
                  {extractResult.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => { setShowZipModal(false); setPendingZipPath(null); setExtractResult(null); }}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-rp-gray-600 mb-5">
              How would you like to organize these files?
            </p>
            <div className="flex flex-col gap-3 mb-5">
              <button
                onClick={handleAIClassify}
                disabled={extracting}
                className="w-full p-4 rounded-xl border-2 border-rp-gold bg-rp-gold-bg text-left hover:shadow-md transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[20px]">⚡</span>
                  <div>
                    <div className="text-sm font-bold text-rp-navy">AI Smart Sort (Recommended)</div>
                    <div className="text-xs text-rp-gray-500 mt-0.5">Claude AI reads filenames and auto-sorts into DD categories: Financials, Legal, Environmental, etc.</div>
                  </div>
                </div>
              </button>
              <button
                onClick={handleExtractZip}
                disabled={extracting}
                className="w-full p-4 rounded-xl border border-rp-gray-200 text-left hover:border-rp-gray-300 transition-all disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[20px]">📁</span>
                  <div>
                    <div className="text-sm font-semibold text-rp-navy">Keep Original Folders</div>
                    <div className="text-xs text-rp-gray-500 mt-0.5">Extract ZIP and preserve the original folder structure as-is.</div>
                  </div>
                </div>
              </button>
            </div>
            {extracting && (
              <div className="flex items-center gap-2 p-3 bg-rp-gold-bg rounded-lg border border-rp-gold-border">
                <div className="w-4 h-4 border-2 border-rp-gold border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-rp-navy">AI is analyzing and sorting your files...</span>
              </div>
            )}
            <div className="flex justify-end mt-3">
              <Button variant="secondary" onClick={() => { setShowZipModal(false); setPendingZipPath(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
