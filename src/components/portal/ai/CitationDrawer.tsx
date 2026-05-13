'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import type { Citation } from '@/lib/ai/types';

interface Props {
  citation: Citation | null;
  onClose: () => void;
}

type FileKind = 'pdf' | 'office' | 'image' | 'other';

function classifyFile(mime: string | null, name: string | null): FileKind {
  const m = (mime ?? '').toLowerCase();
  const ext = (name ?? '').toLowerCase().split('.').pop() ?? '';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (
    m.includes('officedocument') ||
    m === 'application/msword' ||
    m === 'application/vnd.ms-excel' ||
    m === 'application/vnd.ms-powerpoint' ||
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)
  ) return 'office';
  return 'other';
}

export default function CitationDrawer({ citation, onClose }: Props) {
  const t = useTranslations('ai');
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<FileKind>('other');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDocument = citation?.kind === 'document';
  const documentId = isDocument ? citation?.document_id : undefined;

  useEffect(() => {
    setSignedUrl(null);
    setError(null);
    setFileKind('other');
    if (!documentId) return;

    let cancelled = false;
    setLoading(true);
    (async () => {
      const supabase = createClient();
      const { data: doc, error: docErr } = await supabase
        .from('terminal_dd_documents')
        .select('storage_path, name, file_type')
        .eq('id', documentId)
        .maybeSingle();

      if (cancelled) return;
      if (docErr || !doc?.storage_path) {
        setError(docErr?.message ?? 'Source document not found.');
        setLoading(false);
        return;
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from('terminal-dd-documents')
        .createSignedUrl(doc.storage_path, 600);

      if (cancelled) return;
      if (signErr || !signed?.signedUrl) {
        setError(signErr?.message ?? 'Could not generate a signed URL.');
        setLoading(false);
        return;
      }
      setSignedUrl(signed.signedUrl);
      setFileKind(classifyFile(doc.file_type ?? null, doc.name ?? null));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (!citation) return null;

  const viewerUrl = !signedUrl
    ? null
    : fileKind === 'pdf'
      ? `${signedUrl}#page=1`
      : fileKind === 'office'
        ? `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=true`
        : signedUrl;

  const kindIcon: Record<FileKind, React.ReactNode> = {
    pdf: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    office: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </svg>
    ),
    image: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    ),
    other: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };

  return (
    <aside
      role="dialog"
      aria-label={t('sourceDrawerTitle')}
      className="absolute inset-y-0 end-full w-[480px] max-w-[calc(100vw-32px)] bg-[#0B0E14] border-s border-white/[0.06] shadow-[-12px_0_36px_rgba(0,0,0,0.35)] flex flex-col"
    >
      <header className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-[#BC9C45]/30 transition-colors">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#BC9C45]/15 border border-[#BC9C45]/30 flex items-center justify-center text-[#D4A843]">
            {kindIcon[fileKind]}
          </span>
          <div className="flex-1 min-w-0 flex flex-col leading-tight">
            <span className="text-[9px] font-semibold tracking-[1.5px] uppercase text-[#BC9C45]/80">
              {t('sourceDrawerTitle')}
            </span>
            <span className="text-[12px] font-medium text-white truncate">
              {citation.label}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('closeSource')}
          className="shrink-0 w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white/60 hover:text-white cursor-pointer transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-hidden">
        {isDocument ? (
          loading ? (
            <CenteredMessage>{t('loadingSource') ?? 'Loading source…'}</CenteredMessage>
          ) : error ? (
            <CenteredMessage tone="error">{error}</CenteredMessage>
          ) : viewerUrl ? (
            fileKind === 'image' ? (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <img src={viewerUrl} alt={citation.label} className="max-w-full max-h-full object-contain" />
              </div>
            ) : fileKind === 'other' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-[12px] text-white/60">Inline preview is not supported for this file type.</p>
                <a
                  href={viewerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] font-medium text-[#BC9C45] underline hover:text-[#D4A843]"
                >
                  Download source
                </a>
              </div>
            ) : (
              <iframe
                src={viewerUrl}
                title={citation.label}
                className="w-full h-full border-0 bg-white"
              />
            )
          ) : (
            <CenteredMessage>{t('sourceUnavailable') ?? 'Source unavailable.'}</CenteredMessage>
          )
        ) : (
          <div className="p-5">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-5 space-y-2">
              <div className="text-[10px] font-semibold tracking-[1.5px] uppercase text-white/50">
                {citation.kind}
              </div>
              <div className="text-[14px] text-white">{citation.label}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function CenteredMessage({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'error';
}) {
  return (
    <div className="w-full h-full flex items-center justify-center px-6 text-center">
      <p className={`text-[12px] ${tone === 'error' ? 'text-red-400' : 'text-white/60'}`}>
        {children}
      </p>
    </div>
  );
}
