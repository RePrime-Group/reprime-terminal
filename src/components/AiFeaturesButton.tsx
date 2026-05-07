'use client';

import { useDealAssistantPanel } from '@/components/portal/ai/DealAssistantContext';
import { usePathname } from 'next/navigation';

function dealIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/portal\/deals\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function AiFeaturesButton() {
  const { isOpen, open, close } = useDealAssistantPanel();
  const pathname = usePathname();

  if (isOpen) {
    return (
      <button
        type="button"
        onClick={close}
        aria-label="Close AI assistant"
        className="fixed bottom-20 right-5 z-50 group cursor-pointer inline-flex items-center gap-1.5 h-9 ps-3 pe-3.5 rounded-full text-[12px] font-semibold text-[#0B0E14] bg-gradient-to-br from-[#E8C977] via-[#D4B96A] to-[#BC9C45] shadow-[0_6px_18px_rgba(212,185,106,0.4)] hover:shadow-[0_8px_22px_rgba(212,185,106,0.55)] transition-all duration-200"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <line x1="2" y1="2" x2="10" y2="10" />
          <line x1="10" y1="2" x2="2" y2="10" />
        </svg>
        <span className="tracking-[0.2px]">Close</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const dealId = dealIdFromPath(pathname ?? '');
        const dealName = document.querySelector<HTMLElement>('[data-deal-name]')?.dataset.dealName ?? undefined;
        open({ dealId: dealId ?? null, dealName });
      }}
      aria-label="Open AI assistant"
      className="fixed bottom-20 right-5 z-50 group cursor-pointer inline-flex items-center gap-1.5 h-9 ps-3 pe-3.5 rounded-full text-[12px] font-semibold text-[#0B0E14] bg-gradient-to-br from-[#E8C977] via-[#D4B96A] to-[#BC9C45] shadow-[0_6px_18px_rgba(212,185,106,0.4)] hover:shadow-[0_10px_26px_rgba(212,185,106,0.6)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-200 overflow-hidden"
    >
      {/* Shimmer sweep on hover */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
      />
      {/* Sparkle icon */}
      <svg
        className="relative"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path d="M12 2 L13.6 10.4 L22 12 L13.6 13.6 L12 22 L10.4 13.6 L2 12 L10.4 10.4 Z" />
      </svg>
      <span className="relative tracking-[0.2px] whitespace-nowrap">Ask AI</span>
    </button>
  );
}
