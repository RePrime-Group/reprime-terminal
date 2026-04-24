'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';

interface DealNotepadProps {
  dealId: string;
  dealName: string;
  variant: 'card' | 'detail';
  initialContent?: string;
  initialUpdatedAt?: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function formatRelative(date: Date | null): string {
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default function DealNotepad({
  dealId,
  dealName,
  variant,
  initialContent = '',
  initialUpdatedAt,
}: DealNotepadProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null
  );
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [relativeText, setRelativeText] = useState(() =>
    initialUpdatedAt ? formatRelative(new Date(initialUpdatedAt)) : ''
  );

  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<string | null>(null);
  const supabase = useRef(createClient()).current;

  const hasNotes = content.trim().length > 0;
  const isCard = variant === 'card';

  const runSave = useCallback(
    async (value: string) => {
      setStatus('saving');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('error');
        return;
      }
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('user_deal_notes')
        .upsert(
          {
            user_id: user.id,
            deal_id: dealId,
            content: value,
            updated_at: nowIso,
          },
          { onConflict: 'user_id,deal_id' }
        );
      if (error) {
        setStatus('error');
      } else {
        const savedDate = new Date(nowIso);
        setStatus('saved');
        setLastSaved(savedDate);
        setRelativeText(formatRelative(savedDate));
      }
      pendingContentRef.current = null;
    },
    [dealId, supabase]
  );

  const flushNow = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const pending = pendingContentRef.current;
    if (pending !== null) {
      void runSave(pending);
    }
  }, [runSave]);

  const scheduleSave = useCallback(
    (value: string) => {
      pendingContentRef.current = value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void runSave(value);
      }, 500);
    },
    [runSave]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        const pending = pendingContentRef.current;
        if (pending !== null) void runSave(pending);
      }
    };
  }, [runSave]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!panelRef.current || !wrapperRef.current) return;
      const target = e.target as Node;
      if (panelRef.current.contains(target) || wrapperRef.current.contains(target)) return;
      flushNow();
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        flushNow();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, flushNow]);

  useEffect(() => {
    if (!open || !lastSaved) return;
    const id = setInterval(() => {
      setRelativeText(formatRelative(lastSaved));
    }, 15000);
    return () => clearInterval(id);
  }, [open, lastSaved]);

  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panelWidth = isCard ? 300 : 380;
    const reposition = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      let left = rect.left;
      if (left + panelWidth > window.innerWidth - margin) {
        left = Math.max(margin, rect.right - panelWidth);
      }
      const top = rect.bottom + 8;
      setPanelPos({ top, left });
    };
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, isCard]);

  const onToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => {
      const next = !v;
      if (next && lastSaved) setRelativeText(formatRelative(lastSaved));
      return next;
    });
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setContent(next);
    scheduleSave(next);
  };

  const onClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    flushNow();
    setOpen(false);
  };

  const panelWidthClass = isCard ? 'w-[300px]' : 'w-[380px]';
  const textareaRows = isCard ? 6 : 9;

  const statusLine = (() => {
    if (status === 'saving') return { text: 'Saving…', color: 'text-[#6B7280]' };
    if (status === 'error') return { text: 'Save failed', color: 'text-[#DC2626]' };
    if (status === 'saved' || lastSaved)
      return { text: 'Saved ✓', color: 'text-[#0B8A4D]' };
    return { text: '', color: '' };
  })();

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        aria-label="My Notes"
        title="My Notes"
        onClick={onToggle}
        className={[
          'relative flex items-center justify-center cursor-pointer transition-all',
          isCard
            ? 'w-7 h-7 rounded-full shadow-md bg-white/80 backdrop-blur-sm hover:bg-white'
            : 'h-[36px] md:h-[38px] px-3 rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F7F8FA] text-[11px] md:text-[12px] font-semibold text-[#0E3470] gap-1.5',
        ].join(' ')}
      >
        <svg
          width={isCard ? 14 : 16}
          height={isCard ? 14 : 16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={isCard ? (hasNotes ? '#BC9C45' : '#6B7280') : '#0E3470'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
        {!isCard && <span>My Notes</span>}
        {hasNotes && (
          <span
            className={[
              'absolute bg-[#BC9C45] rounded-full ring-2 ring-white',
              isCard ? 'top-[-2px] right-[-2px] w-[8px] h-[8px]' : 'top-[-3px] right-[-3px] w-[9px] h-[9px]',
            ].join(' ')}
          />
        )}
      </button>

      {open && panelPos && createPortal(
        <div
          ref={panelRef}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left }}
          className={[
            'z-[1000] bg-white rounded-[12px] shadow-[0_10px_30px_rgba(14,52,112,0.18),0_2px_8px_rgba(14,52,112,0.08)] border border-[#EEF0F4] overflow-hidden',
            panelWidthClass,
          ].join(' ')}
        >
          <div className="px-4 pt-3 pb-2 border-b border-[#EEF0F4]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[1.8px] text-[#6B7280]">
                My Notes
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1 -m-1 text-[#9CA3AF] hover:text-[#0E3470] rounded"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3l10 10M13 3L3 13" />
                </svg>
              </button>
            </div>
            <p className="text-[13px] font-semibold text-[#0E3470] truncate mt-0.5">
              {dealName}
            </p>
          </div>

          <div className="px-4 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={onChange}
              rows={textareaRows}
              placeholder="Add your private notes about this deal..."
              className="w-full resize-none text-[13px] text-[#0A1628] placeholder:text-[#9CA3AF] border border-[#E5E7EB] rounded-[8px] px-3 py-2 focus:outline-none focus:border-[#BC9C45] focus:ring-2 focus:ring-[#BC9C45]/20 leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between px-4 pb-3 pt-1 text-[11px]">
            <span className={statusLine.color}>{statusLine.text}</span>
            {lastSaved && relativeText && (
              <span className="text-[#9CA3AF]">Last: {relativeText}</span>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
