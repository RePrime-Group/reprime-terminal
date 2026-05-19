'use client';

import { useDealAssistantPanelOptional } from '@/components/portal/ai/DealAssistantContext';

interface Props {
  dealId: string;
  dealName: string;
}

export function AISpotlightBanner({ dealId, dealName }: Props) {
  const assistantPanel = useDealAssistantPanelOptional();
  return (
    <div className="relative overflow-hidden bg-[#0E3470] px-4 md:px-8 py-3.5 flex items-center justify-between gap-3 border-y border-white/[0.05]">
      <div
        className="pointer-events-none absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#BC9C45]/45 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#BC9C45]/20 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{ background: 'radial-gradient(ellipse 50% 100% at 25% 50%, rgba(212,185,106,1) 0%, transparent 65%)' }}
        aria-hidden
      />

      <div className="relative flex items-center gap-3 min-w-0 flex-1">
        <div className="relative flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#BC9C45]/25 to-[#BC9C45]/5 border border-[#BC9C45]/40 flex items-center justify-center">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D4B96A"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="5" y1="11" x2="5" y2="13" />
            <line x1="9" y1="9" x2="9" y2="15" />
            <line x1="13" y1="6" x2="13" y2="18" />
            <line x1="17" y1="9" x2="17" y2="15" />
            <line x1="21" y1="11" x2="21" y2="13" />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 flex w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-[#22C55E] animate-ping opacity-70" aria-hidden />
            <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-[#22C55E] ring-2 ring-[#07090F]" aria-hidden />
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[2.5px] text-[#D4A843]">
              Terminal Intelligence
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full bg-[#22C55E]/10 border border-[#22C55E]/30 text-[8px] font-bold uppercase tracking-[1.5px] text-[#4ADE80]">
              <span className="w-1 h-1 rounded-full bg-[#4ADE80]" aria-hidden />
              Live
            </span>
          </div>
          <p className="hidden sm:block text-[11.5px] text-white/55 leading-tight mt-0.5 truncate">
            Ask about financials, tenants, or leases on this deal.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => assistantPanel?.open({ dealId, dealName })}
        className="relative flex-shrink-0 group inline-flex items-center gap-1.5 h-9 ps-3.5 pe-4 rounded-full text-[12px] font-semibold text-[#0B0E14] bg-gradient-to-br from-[#E8C977] via-[#D4B96A] to-[#BC9C45] shadow-[0_2px_10px_rgba(212,185,106,0.35)] hover:shadow-[0_6px_22px_rgba(212,185,106,0.6)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200 overflow-hidden"
      >
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
        />
        <svg
          className="relative"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="5" y1="11" x2="5" y2="13" />
          <line x1="9" y1="9" x2="9" y2="15" />
          <line x1="13" y1="6" x2="13" y2="18" />
          <line x1="17" y1="9" x2="17" y2="15" />
          <line x1="21" y1="11" x2="21" y2="13" />
        </svg>
        <span className="relative tracking-[0.2px]">Ask AI Assistant</span>
        <svg
          className="relative opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
