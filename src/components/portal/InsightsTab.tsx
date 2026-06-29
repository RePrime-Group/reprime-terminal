'use client';

import { useMemo } from 'react';
import type { DealInsight } from '@/lib/types/database';

// ─────────────────────────────────────────────────────────────────────────────
// Investor-facing Insights tab. Pure display — insights grouped by their
// category's display name. Data arrives pre-joined from DealDetailClient.
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

  if (groups.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {groups.map((group) => (
        <div
          key={group.categoryId}
          className="bg-white rounded-2xl border border-rp-gray-200 p-6"
        >
          <h3 className="text-[11px] font-bold uppercase tracking-[1.5px] text-rp-gold mb-4">
            {group.displayName}
          </h3>
          <ul className="space-y-3">
            {group.items.map((ins) => (
              <li key={ins.id} className="flex items-start gap-3">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-rp-gold shrink-0" />
                <p className="text-[13px] leading-relaxed text-rp-gray-700 whitespace-pre-wrap">
                  {ins.content}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
