'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';

export interface MultiSelectOption {
  id: string;
  primary: string;
  secondary?: string;
}

/**
 * A clean popover multi-select: a trigger button opens a searchable checklist
 * with a confirm footer. onConfirm returns true on success (clears + closes),
 * false to keep it open so the user can retry.
 */
export default function MultiSelectDropdown({
  triggerLabel,
  searchPlaceholder,
  options,
  emptyText,
  confirmLabel,
  onConfirm,
}: {
  triggerLabel: string;
  searchPlaceholder: string;
  options: MultiSelectOption[];
  emptyText: string;
  confirmLabel: (count: number) => string;
  onConfirm: (ids: string[]) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      [o.primary, o.secondary].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [options, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    const ok = await onConfirm([...selected]);
    setBusy(false);
    if (ok) {
      setSelected(new Set());
      setSearch('');
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        {triggerLabel}
      </Button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[320px] bg-white rounded-xl border border-rp-gray-200 shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-rp-gray-100">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-3 py-2 border border-rp-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold outline-none"
            />
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-rp-gray-400 py-6 text-center">{emptyText}</p>
            ) : (
              filtered.map((o) => {
                const checked = selected.has(o.id);
                return (
                  <label
                    key={o.id}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                      checked ? 'bg-rp-gold/[0.06]' : 'hover:bg-rp-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-rp-gray-700 truncate">
                        {o.primary}
                      </span>
                      {o.secondary && (
                        <span className="block text-[11px] text-rp-gray-400 truncate">{o.secondary}</span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-3 border-t border-rp-gray-100 bg-rp-gray-50">
            <Button variant="gold" size="sm" onClick={confirm} loading={busy} disabled={selected.size === 0}>
              {confirmLabel(selected.size)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
