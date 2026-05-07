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
        className="fixed bottom-20 right-5 z-50 group cursor-pointer"
      >
        <span className="flex items-center justify-center w-11 h-11 rounded-full bg-[#BC9C45]/20 border border-[#BC9C45] shadow-[0_10px_30px_rgba(10,22,40,0.35)] transition-colors">
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#D4A843" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </span>
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
      className="fixed bottom-20 right-5 z-50 group cursor-pointer"
    >
      {/* Tooltip */}
      <span
        className="pointer-events-none absolute bottom-full right-0 mb-2.5 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#BC9C45]/25 bg-[#0A1628]/95 backdrop-blur-md px-3 py-1.5 shadow-[0_8px_24px_rgba(7,9,15,0.5)] opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 ease-out"
        aria-hidden
      >
        <span className="w-1 h-1 rounded-full bg-[#D4A843] flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-[2.5px] text-white/70">
          Terminal
        </span>
        <span className="font-[family-name:var(--font-playfair)] italic text-[#D4A843] text-[11px] leading-none">
          Intelligence
        </span>
        {/* Tail */}
        <span className="absolute -bottom-[5px] right-4 w-2.5 h-2.5 rotate-45 border-b border-r border-[#BC9C45]/25 bg-[#0A1628]/95" aria-hidden />
      </span>

      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-[#0A1628] border border-[#BC9C45]/40 shadow-[0_10px_30px_rgba(10,22,40,0.35)] hover:border-[#BC9C45] transition-colors">
        <span className="absolute inset-0 rounded-full bg-[#BC9C45]/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
        <img
          src="/ai-search.svg"
          alt=""
          aria-hidden
          className="relative w-5 h-5"
          style={{ filter: 'invert(72%) sepia(41%) saturate(502%) hue-rotate(5deg) brightness(98%) contrast(87%)' }}
        />
      </span>
    </button>
  );
}
