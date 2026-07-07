'use client';

/* Google Drive panel for the admin data room.
   Two features, both requiring an org-wide Google account (connected in
   Admin > Settings):
     1. Connect a Drive FOLDER to this deal (n8n watches it) — one per deal.
        Uses a custom folder browser (breadcrumb + "connect the folder you're
        in") because the Google Picker can't reliably select the current folder.
     2. Import FILES from the connected Drive. The Picker forgets selections
        when you change folders, so we stage picked files in our own list and
        let the user "Add more from Drive" across folders before importing.
   When no account is connected, it shows a link to Settings instead. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import {
  getDrivePickerConfig,
  getDealDriveFolder,
  connectDealDriveFolder,
  disconnectDealDriveFolder,
  importDriveFiles,
  listDriveFolders,
  searchDriveFolders,
  type DrivePickerConfig,
  type DealDriveFolder,
} from '../actions';
import type { DriveFolderEntry } from '@/lib/google/drive';

// The Google Picker JS API is loaded at runtime and has no bundled types; a
// minimal shape keeps the rest of the file type-checked.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: { load: (name: string, cb: () => void) => void };
    google?: { picker: any };
  }
}
type PickerDoc = { id: string; name?: string; mimeType?: string };
/* eslint-enable @typescript-eslint/no-explicit-any */

const GAPI_SRC = 'https://apis.google.com/js/api.js';

// Load api.js once and ready the 'picker' module. Resolves when window.google.picker exists.
function loadPicker(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) return resolve();
    const finish = () => {
      if (!window.gapi) return reject(new Error('gapi failed to load'));
      window.gapi.load('picker', () => resolve());
    };
    const existing = document.getElementById('gapi-picker-script') as HTMLScriptElement | null;
    if (existing) {
      if (window.gapi) finish();
      else existing.addEventListener('load', finish, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.id = 'gapi-picker-script';
    s.src = GAPI_SRC;
    s.async = true;
    s.onload = finish;
    s.onerror = () => reject(new Error('Failed to load Google API script'));
    document.body.appendChild(s);
  });
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.6" className="shrink-0">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

export function GoogleDrivePanel({
  dealId,
  locale,
  folderOptions,
  onImported,
}: {
  dealId: string;
  locale: string;
  folderOptions: { id: string; label: string }[];
  onImported: () => void | Promise<void>;
}) {
  const t = useTranslations('admin.dataroom.drive');

  const [config, setConfig] = useState<DrivePickerConfig | null>(null);
  const [dealFolder, setDealFolder] = useState<DealDriveFolder | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const configRef = useRef<DrivePickerConfig | null>(null);

  // Folder browser (Feature 1)
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState<DriveFolderEntry[]>([]);
  const [browseFolders, setBrowseFolders] = useState<DriveFolderEntry[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // Folder search (null = not searching / showing the browse tree)
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DriveFolderEntry[] | null>(null);

  // File import staging (Feature 2)
  const [pendingFiles, setPendingFiles] = useState<PickerDoc[] | null>(null);
  // Empty string means "default to the first folder", resolved at render below.
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [importing, setImporting] = useState(false);

  const selectedTarget = targetFolder || folderOptions[0]?.id || '';

  useEffect(() => {
    getDrivePickerConfig().then((c) => {
      setConfig(c);
      configRef.current = c;
    });
    getDealDriveFolder(dealId).then(setDealFolder);
  }, [dealId]);

  const flashToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Feature 1: custom folder browser ──────────────────────────────────────

  const loadFolders = useCallback(
    async (parentId: string) => {
      setBrowseLoading(true);
      const res = await listDriveFolders(parentId);
      if (res.ok) setBrowseFolders(res.folders);
      else flashToast('error', res.error);
      setBrowseLoading(false);
    },
    [flashToast],
  );

  const openFolderBrowser = useCallback(() => {
    const root = { id: 'root', name: t('myDrive') };
    setBrowsePath([root]);
    setBrowseFolders([]);
    setSearchQuery('');
    setSearchResults(null);
    setBrowserOpen(true);
    loadFolders('root');
  }, [t, loadFolders]);

  const runSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const res = await searchDriveFolders(q);
    setSearching(false);
    if (res.ok) setSearchResults(res.folders);
    else flashToast('error', res.error);
  }, [searchQuery, flashToast]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
  }, []);

  // Open a search result in the browse tree (its ancestry is unknown, so the
  // breadcrumb restarts at root › result — deeper navigation still works).
  const openSearchResult = useCallback(
    (folder: DriveFolderEntry) => {
      const root = { id: 'root', name: t('myDrive') };
      setSearchResults(null);
      setSearchQuery('');
      setBrowsePath([root, folder]);
      loadFolders(folder.id);
    },
    [t, loadFolders],
  );

  const enterFolder = useCallback(
    (folder: DriveFolderEntry) => {
      setBrowsePath((prev) => [...prev, folder]);
      loadFolders(folder.id);
    },
    [loadFolders],
  );

  const jumpToCrumb = useCallback(
    (index: number) => {
      setBrowsePath((prev) => {
        const next = prev.slice(0, index + 1);
        loadFolders(next[next.length - 1].id);
        return next;
      });
    },
    [loadFolders],
  );

  const current = browsePath[browsePath.length - 1] ?? null;
  const atRoot = browsePath.length <= 1;

  const connectFolder = useCallback(
    async (folder: DriveFolderEntry) => {
      if (folder.id === 'root') return;
      setConnecting(true);
      const res = await connectDealDriveFolder(dealId, folder.id, folder.name);
      setConnecting(false);
      if (res.ok) {
        setDealFolder({ drive_folder_id: folder.id, drive_folder_name: folder.name });
        setBrowserOpen(false);
        flashToast('success', t('folderConnected'));
      } else {
        flashToast('error', res.error);
      }
    },
    [dealId, flashToast, t],
  );

  const handleDisconnectFolder = useCallback(async () => {
    const res = await disconnectDealDriveFolder(dealId);
    if (res.ok) {
      setDealFolder(null);
      flashToast('success', t('folderDisconnected'));
    } else {
      flashToast('error', res.error);
    }
  }, [dealId, flashToast, t]);

  // ── Feature 2: file Picker (staged, accumulates across folders) ────────────

  const addFromDrive = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg?.connected || !cfg.token) return;
    try {
      await loadPicker();
    } catch {
      flashToast('error', t('pickerLoadError'));
      return;
    }
    const g = window.google!.picker;

    const sx = window.scrollX;
    const sy = window.scrollY;
    const restoreScroll = () => window.scrollTo(sx, sy);

    const view = new g.DocsView(g.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    let builder = new g.PickerBuilder()
      .setOrigin(window.location.origin)
      .setTitle(t('pickFilesTitle'))
      .setOAuthToken(cfg.token)
      .setAppId(cfg.appId || '')
      .addView(view)
      .enableFeature(g.Feature.MULTISELECT_ENABLED)
      .setCallback((data: { action: string; docs?: PickerDoc[] }) => {
        if (data.action === g.Action.LOADED) restoreScroll();
        if (data.action === g.Action.PICKED && data.docs?.length) {
          // Accumulate + dedupe so files gathered from several folders across
          // multiple picker sessions all land in one import.
          setPendingFiles((prev) => {
            const map = new Map((prev ?? []).map((d) => [d.id, d]));
            for (const d of data.docs!) map.set(d.id, d);
            return Array.from(map.values());
          });
        }
      });
    if (cfg.apiKey) builder = builder.setDeveloperKey(cfg.apiKey);

    builder.build().setVisible(true);
    requestAnimationFrame(restoreScroll);
    setTimeout(restoreScroll, 150);
    setTimeout(restoreScroll, 400);
  }, [flashToast, t]);

  const removePending = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const next = (prev ?? []).filter((d) => d.id !== id);
      return next.length ? next : null;
    });
  }, []);

  const confirmImport = useCallback(async () => {
    if (!pendingFiles || !selectedTarget) return;
    setImporting(true);
    const res = await importDriveFiles(
      dealId,
      selectedTarget,
      pendingFiles.map((d) => d.id),
    );
    setImporting(false);
    setPendingFiles(null);
    if (res.imported > 0) await onImported();

    const parts = [t('imported', { count: res.imported })];
    if (res.skipped > 0) parts.push(t('skippedDup', { count: res.skipped }));
    if (res.errors.length > 0) parts.push(t('failedCount', { count: res.errors.length }));
    flashToast(res.errors.length === 0 ? 'success' : 'error', parts.join(' · '));
  }, [pendingFiles, selectedTarget, dealId, onImported, flashToast, t]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (config === null) {
    return (
      <div className="mb-4 rounded-xl border border-rp-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-rp-gray-400">{t('loading')}</p>
      </div>
    );
  }

  if (!config.connected) {
    return (
      <div className="mb-4 rounded-xl border border-rp-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-rp-navy">{t('title')}</h3>
            <p className="text-[12px] text-rp-gray-500 mt-0.5">{t('notConnected')}</p>
          </div>
          <a href={`/${locale}/admin/settings`}>
            <Button variant="secondary" size="sm">
              {t('connectInSettings')}
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-rp-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-rp-navy">{t('title')}</h3>
      </div>

      {toast && (
        <div
          className={`mb-3 rounded-lg px-4 py-2.5 text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Feature 1: connect a watched folder */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-rp-gray-100">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-rp-navy">{t('watchedFolder')}</div>
          {dealFolder ? (
            <div className="text-[12px] text-rp-gray-600 truncate">
              {t('watching')} <span className="font-medium">{dealFolder.drive_folder_name}</span>
            </div>
          ) : (
            <div className="text-[12px] text-rp-gray-500">{t('watchedFolderDesc')}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dealFolder && (
            <Button variant="secondary" size="sm" onClick={handleDisconnectFolder}>
              {t('disconnect')}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={openFolderBrowser}>
            {dealFolder ? t('changeFolder') : t('connectFolder')}
          </Button>
        </div>
      </div>

      {/* Feature 2: import files */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-2 mt-1">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-rp-navy">{t('importFiles')}</div>
          <div className="text-[12px] text-rp-gray-500">{t('importFilesDesc')}</div>
        </div>
        <Button variant="primary" size="sm" disabled={folderOptions.length === 0} onClick={addFromDrive}>
          {t('importFromDrive')}
        </Button>
      </div>
      {folderOptions.length === 0 && (
        <p className="text-[11px] text-rp-gray-400 mt-1">{t('noFolders')}</p>
      )}

      {/* ── Folder browser modal (Feature 1) ── */}
      {browserOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !connecting && setBrowserOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-rp-navy mb-1">{t('browseTitle')}</h3>
            <p className="text-[12px] text-rp-gray-500 mb-3">{t('browseHint')}</p>

            {/* Search */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch();
                }}
                placeholder={t('searchPlaceholder')}
                className="flex-1 px-3 py-2 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold"
              />
              <Button variant="secondary" size="sm" loading={searching} onClick={runSearch}>
                {t('search')}
              </Button>
              {searchResults !== null && (
                <Button variant="secondary" size="sm" onClick={clearSearch}>
                  {t('clear')}
                </Button>
              )}
            </div>

            {/* Breadcrumb (browse mode only) */}
            {searchResults === null && (
              <div className="flex flex-wrap items-center gap-1 text-[12px] text-rp-gray-600 mb-2">
                {browsePath.map((crumb, i) => (
                  <span key={crumb.id} className="flex items-center gap-1">
                    {i > 0 && <span className="text-rp-gray-300">/</span>}
                    <button
                      type="button"
                      onClick={() => jumpToCrumb(i)}
                      className={`hover:text-rp-gold ${i === browsePath.length - 1 ? 'font-semibold text-rp-navy' : ''}`}
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Folder list — search results or the browse tree */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-rp-gray-100 divide-y divide-rp-gray-100 min-h-[120px]">
              {searchResults !== null ? (
                searchResults.length === 0 ? (
                  <div className="p-4 text-[12px] text-rp-gray-400">{t('searchNoResults')}</div>
                ) : (
                  searchResults.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 px-3 py-2 text-[13px] text-rp-gray-700">
                      <FolderIcon />
                      <button
                        type="button"
                        onClick={() => openSearchResult(f)}
                        className="truncate flex-1 text-left hover:text-rp-gold"
                      >
                        {f.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => connectFolder(f)}
                        disabled={connecting}
                        className="text-[11px] font-medium text-rp-gold hover:underline shrink-0"
                      >
                        {t('connect')}
                      </button>
                    </div>
                  ))
                )
              ) : browseLoading ? (
                <div className="p-4 text-[12px] text-rp-gray-400">{t('loadingFolders')}</div>
              ) : browseFolders.length === 0 ? (
                <div className="p-4 text-[12px] text-rp-gray-400">{t('noSubfolders')}</div>
              ) : (
                browseFolders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => enterFolder(f)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-rp-gray-700 hover:bg-rp-gray-50"
                  >
                    <FolderIcon />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-[11px] text-rp-gray-400">{t('open')}</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 mt-4">
              <span className="text-[11px] text-rp-gray-400">
                {searchResults === null && atRoot ? t('connectRootHint') : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={connecting}
                  onClick={() => setBrowserOpen(false)}
                >
                  {t('cancel')}
                </Button>
                {searchResults === null && (
                  <Button
                    variant="gold"
                    size="sm"
                    loading={connecting}
                    disabled={atRoot}
                    onClick={() => current && connectFolder(current)}
                  >
                    {t('connectThisFolder')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Import staging modal (Feature 2) ── */}
      {pendingFiles && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !importing && setPendingFiles(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-rp-navy mb-1">{t('importModalTitle')}</h3>
            <p className="text-[13px] text-rp-gray-500 mb-3">
              {t('filesSelected', { count: pendingFiles.length })}
            </p>

            <div className="max-h-40 overflow-y-auto mb-3 rounded-lg border border-rp-gray-100 bg-rp-gray-50/50 divide-y divide-rp-gray-100">
              {pendingFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[12px] text-rp-gray-700 truncate flex-1">{f.name ?? f.id}</span>
                  <button
                    type="button"
                    onClick={() => removePending(f.id)}
                    disabled={importing}
                    className="text-rp-gray-400 hover:text-red-500 text-sm leading-none"
                    aria-label={t('remove')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addFromDrive}
              disabled={importing}
              className="text-[12px] font-medium text-rp-gold hover:underline mb-4"
            >
              + {t('addMore')}
            </button>

            <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
              {t('destination')}
            </label>
            <select
              value={selectedTarget}
              onChange={(e) => setTargetFolder(e.target.value)}
              className="w-full px-3 py-2 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold mb-5"
            >
              {folderOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" disabled={importing} onClick={() => setPendingFiles(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={importing}
                disabled={!selectedTarget}
                onClick={confirmImport}
              >
                {t('confirmImport')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
