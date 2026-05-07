'use client';

import { useDealAssistantPanel } from './DealAssistantContext';

interface Props {
  dealId: string;
  dealName: string;
}

export default function DealCardAiIcon({ dealId, dealName }: Props) {
  const { open } = useDealAssistantPanel();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open({ dealId, dealName });
      }}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label={`Ask AI Assistant about ${dealName}`}
      className="ms-auto inline-flex items-center gap-1 text-white text-[10px] font-semibold px-2.5 py-[5px] rounded-full shadow-[0_1px_4px_rgba(188,156,69,0.35)] hover:shadow-[0_2px_8px_rgba(188,156,69,0.55)] hover:-translate-y-[0.5px] active:translate-y-0 cursor-pointer transition-all duration-150"
      style={{
        background: 'linear-gradient(135deg, #BC9C45 0%, #D4B85A 50%, #BC9C45 100%)',
      }}
    >
      <svg
        width="10"
        height="10"
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
      Ask AI Assistant
    </button>
  );
}
