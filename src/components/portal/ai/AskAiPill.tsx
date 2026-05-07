'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useDealAssistantPanel } from './DealAssistantContext';

function dealIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/portal\/deals\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function AskAiPill() {
  const t = useTranslations('ai');
  const locale = useLocale();
  const isRtl = locale === 'he';
  const pathname = usePathname();
  const { isOpen, open } = useDealAssistantPanel();

  if (isOpen) return null;

  const sideClass = isRtl ? 'right-5' : 'left-5';

  return (
    <button
      type="button"
      onClick={() => {
        const dealId = dealIdFromPath(pathname ?? '');
        const dealName =
          document.querySelector<HTMLElement>('[data-deal-name]')?.dataset.dealName ?? undefined;
        open({ dealId, dealName });
      }}
      aria-label={t('openAssistant')}
      className={`fixed bottom-5 ${sideClass} z-40 group animate-rp-pill-in inline-flex items-center gap-2 ps-2.5 pe-3.5 h-11 rounded-full text-white text-[12.5px] font-semibold transition-all duration-300`}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-gradient-to-br from-[#E8C977] via-[#D4B96A] to-[#A88A3D] shadow-[0_8px_24px_rgba(188,156,69,0.45)] group-hover:shadow-[0_12px_30px_rgba(188,156,69,0.65)] group-hover:-translate-y-[1px] group-active:translate-y-0 transition-all duration-300"
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ boxShadow: '0 0 0 6px rgba(212,185,106,0.12)' }}
      />
      <span
        aria-hidden
        className="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#0B0E14]/85 text-[#D4B96A] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      </span>
      <span className="relative tracking-[0.2px] text-[#0B0E14]">{t('askPill')}</span>
    </button>
  );
}
