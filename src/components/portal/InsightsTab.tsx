'use client';

import { useMemo, useState } from 'react';
import type { DealInsight } from '@/lib/types/database';

// ─────────────────────────────────────────────────────────────────────────────
// Investor-facing Insights tab. Pure display — insights grouped into
// collapsible category sections. Data arrives pre-joined from DealDetailClient.
// ─────────────────────────────────────────────────────────────────────────────

interface InsightsTabProps {
  insights: DealInsight[];
}

interface Group {
  categoryId: string;
  displayName: string;
  items: DealInsight[];
}

export default function InsightsTab({ insights }: InsightsTabProps) {
  const groups = useMemo<Group[]>(() => {
    const byCategory = new Map<string, Group>();
    for (const ins of insights) {
      const displayName = ins.category?.display_name ?? 'Uncategorized';
      const existing = byCategory.get(ins.category_id);
      if (existing) {
        existing.items.push(ins);
      } else {
        byCategory.set(ins.category_id, {
          categoryId: ins.category_id,
          displayName,
          items: [ins],
        });
      }
    }
    return Array.from(byCategory.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }, [insights]);

  // All sections start expanded; collapsing tracks the closed set.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (groups.length === 0) return null;

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-[920px] mx-auto">
      <div className="mb-6">
        <h2 className="text-[22px] font-semibold text-rp-navy font-[family-name:var(--font-playfair)]">
          Deal Insights
        </h2>
        <p className="text-[13px] text-rp-gray-500 mt-1">
          Context and color from the deal team, organized by theme.
        </p>
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const isOpen = !collapsed.has(group.categoryId);
          return (
            <div
              key={group.categoryId}
              className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden shadow-[0_1px_2px_rgba(14,52,112,0.04)]"
            >
              <button
                type="button"
                onClick={() => toggle(group.categoryId)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-rp-gray-50/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-1.5 h-6 rounded-full bg-rp-gold shrink-0" />
                  <span className="text-[15px] font-semibold text-rp-navy truncate">
                    {group.displayName}
                  </span>
                  <span className="text-[11px] font-semibold text-rp-gray-500 bg-rp-gray-100 rounded-full px-2 py-0.5 shrink-0">
                    {group.items.length}
                  </span>
                </div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-rp-gray-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-rp-gray-100">
                  <ul className="space-y-3 mt-3">
                    {group.items.map((ins) => (
                      <li key={ins.id} className="flex items-start gap-3">
                        <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-rp-gold shrink-0" />
                        <p className="text-[13.5px] leading-relaxed text-rp-gray-700 whitespace-pre-wrap">
                          {ins.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
