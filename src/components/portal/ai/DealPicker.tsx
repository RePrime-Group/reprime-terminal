'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { searchDeals, type DealSearchResult } from '@/lib/ai/actions';

interface Props {
  onSelect: (id: string, name: string) => void;
}

export default function DealPicker({ onSelect }: Props) {
  const t = useTranslations('ai');
  const [query, setQuery] = useState('');
  const [deals, setDeals] = useState<DealSearchResult[] | null>(null);

  // Search runs on the server against the full set the user may ask about.
  // Filtering a fetched page in the browser is what made a deal further down
  // the list report "No deals found", which reads as "that deal does not
  // exist". Results are left on screen while a new search is in flight, so
  // typing does not flash the list between keystrokes.
  useEffect(() => {
    let cancelled = false;
    const term = query.trim();
    const handle = setTimeout(
      () => {
        searchDeals(term)
          .then((rows) => {
            if (!cancelled) setDeals(rows);
          })
          .catch(() => {
            if (!cancelled) setDeals([]);
          });
      },
      term ? 220 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="text-[11px] font-semibold tracking-[1.5px] uppercase text-[#BC9C45] mb-2">
          {t('selectDealPrompt')}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchDeals')}
          aria-label={t('searchDeals')}
          autoFocus
          className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#BC9C45]/45 focus:bg-white/[0.06] transition-colors"
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {deals === null ? (
          <div className="px-5 py-8 flex justify-center">
            <span className="inline-flex gap-1" aria-label="Loading">
              <span className="w-1.5 h-1.5 rounded-full bg-[#BC9C45]/70 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#BC9C45]/70 animate-pulse [animation-delay:120ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#BC9C45]/70 animate-pulse [animation-delay:240ms]" />
            </span>
          </div>
        ) : deals.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12px] text-white/40">
            {t('noDealsFound')}
          </div>
        ) : (
          deals.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id, d.name)}
              className="w-full px-5 py-3 text-start text-[13px] text-white/90 hover:bg-white/[0.04] hover:text-white border-b border-white/[0.03] last:border-b-0 cursor-pointer transition-colors flex items-center gap-3 group"
            >
              <span
                aria-hidden
                className="w-7 h-7 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[11px] font-semibold text-[#D4B96A] group-hover:border-[#BC9C45]/40 transition-colors"
              >
                {d.name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{d.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
