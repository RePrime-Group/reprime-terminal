'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useDealAssistantPanel } from './DealAssistantContext';

function dealIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/portal\/deals\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function AskAiSelector() {
  const t = useTranslations('ai');
  const pathname = usePathname();
  const { open } = useDealAssistantPanel();

  return (
    <button
      type="button"
      onClick={() => {
        const dealId = dealIdFromPath(pathname ?? '');
        const dealName =
          (document.querySelector<HTMLElement>('[data-deal-name]')?.dataset.dealName) ??
          undefined;
        open({ dealId: dealId ?? null, dealName });
      }}
      aria-label={t('askAboutDeal')}
      className="hidden md:inline-flex relative items-center gap-1.5 h-[34px] pl-3 pr-3.5 rounded-full text-[11px] font-semibold text-[#0B0E14] bg-gradient-to-br from-[#E8C977] via-[#D4B96A] to-[#BC9C45] shadow-[0_2px_10px_rgba(212,185,106,0.35)] hover:shadow-[0_4px_18px_rgba(212,185,106,0.55)] hover:-translate-y-[1px] active:translate-y-0 cursor-pointer transition-all duration-200 group overflow-hidden"
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
      />
      <img
        src="/ai-search.svg"
        alt=""
        aria-hidden
        className="relative w-[14px] h-[14px]"
        style={{ filter: 'brightness(0)' }}
      />
      <span className="relative tracking-[0.3px]">{t('askAboutDealShort')}</span>
    </button>
  );
}
