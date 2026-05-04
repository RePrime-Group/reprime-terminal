'use client';

import type { ReactNode } from 'react';
import { DEAL_STATUS_LABELS } from '@/lib/constants';
import type { DealStatus } from '@/lib/types/database';

interface DealStatusGroupProps {
  status: DealStatus;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export default function DealStatusGroup({
  status,
  count,
  collapsed,
  onToggle,
  children,
}: DealStatusGroupProps) {
  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white rounded-lg border border-rp-gray-200 hover:border-rp-gold/40 transition-colors sticky top-0 z-10"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-rp-navy uppercase tracking-wider">
            {DEAL_STATUS_LABELS[status] ?? status}
          </span>
          <span className="text-xs text-rp-gray-500">({count})</span>
        </div>
        <span
          className={`text-rp-gray-400 text-sm transition-transform ${
            collapsed ? '' : 'rotate-180'
          }`}
        >
          ▼
        </span>
      </button>
      {!collapsed && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}
