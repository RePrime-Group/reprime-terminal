'use client';

/* ---------- Prev/Next Deal Arrow ---------- */

export function DealNavArrow({
  direction,
  target,
  locale,
  previewMode,
  activeTab,
  label,
  compact = false,
}: {
  direction: 'prev' | 'next';
  target: { id: string; name: string } | null;
  locale: string;
  previewMode: boolean;
  activeTab: string;
  label: string;
  compact?: boolean;
}) {
  const basePath = previewMode
    ? `/${locale}/admin/deals`
    : `/${locale}/portal/deals`;
  const tabQuery = activeTab && activeTab !== 'overview' ? `?tab=${activeTab}` : '';
  const href = target
    ? (previewMode
        ? `${basePath}/${target.id}/preview${tabQuery}`
        : `${basePath}/${target.id}${tabQuery}`)
    : null;

  const titleText = target ? `${label}: ${target.name}` : label;
  const isPrev = direction === 'prev';
  const iconPath = isPrev ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  const sizeClass = compact ? 'w-9 h-9' : 'w-11 h-11 md:w-12 md:h-12';
  const iconSize = compact ? 18 : 22;
  const sharedClass = `flex items-center justify-center ${sizeClass} rounded-full border-2 transition-all shrink-0`;

  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        title={titleText}
        className={`${sharedClass} border-[#EEF0F4] bg-white opacity-40 cursor-not-allowed shadow-[0_4px_14px_rgba(14,52,112,0.08)]`}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={iconPath} />
        </svg>
      </span>
    );
  }

  return (
    <a
      href={href}
      aria-label={titleText}
      title={titleText}
      className={`${sharedClass} border-[#BC9C45]/40 bg-white text-[#0E3470] shadow-[0_4px_14px_rgba(14,52,112,0.12)] hover:border-[#BC9C45] hover:bg-[#BC9C45] hover:text-white hover:shadow-[0_6px_20px_rgba(188,156,69,0.35)] hover:-translate-y-0.5`}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
    </a>
  );
}

/* ---------- Stacked Prev/Next Deal Buttons (header bar) ---------- */

export function DealPager({
  prevDeal,
  nextDeal,
  locale,
  previewMode,
  activeTab,
  prevLabel,
  nextLabel,
}: {
  prevDeal: { id: string; name: string } | null;
  nextDeal: { id: string; name: string } | null;
  locale: string;
  previewMode: boolean;
  activeTab: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const basePath = previewMode
    ? `/${locale}/admin/deals`
    : `/${locale}/portal/deals`;
  const tabQuery = activeTab && activeTab !== 'overview' ? `?tab=${activeTab}` : '';

  function hrefFor(target: { id: string; name: string } | null): string | null {
    if (!target) return null;
    return previewMode
      ? `${basePath}/${target.id}/preview${tabQuery}`
      : `${basePath}/${target.id}${tabQuery}`;
  }

  const prevHref = hrefFor(prevDeal);
  const nextHref = hrefFor(nextDeal);

  const buttonBase =
    'inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[1.5px] transition-all whitespace-nowrap min-w-[140px]';
  const buttonEnabled =
    'bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-white shadow-[0_3px_10px_rgba(188,156,69,0.3)] hover:from-[#A88A3D] hover:to-[#BC9C45] hover:shadow-[0_5px_16px_rgba(188,156,69,0.45)] hover:-translate-y-0.5';
  const buttonDisabled = 'bg-[#EEF0F4] text-[#9CA3AF] cursor-not-allowed';

  return (
    <div className="flex flex-col gap-2 shrink-0 self-start ml-auto">
      {prevHref ? (
        <a
          href={prevHref}
          title={prevDeal ? `${prevLabel}: ${prevDeal.name}` : prevLabel}
          aria-label={prevDeal ? `${prevLabel}: ${prevDeal.name}` : prevLabel}
          className={`${buttonBase} ${buttonEnabled}`}
        >
          {prevLabel}
        </a>
      ) : (
        <span aria-disabled="true" className={`${buttonBase} ${buttonDisabled}`}>
          {prevLabel}
        </span>
      )}

      {nextHref ? (
        <a
          href={nextHref}
          title={nextDeal ? `${nextLabel}: ${nextDeal.name}` : nextLabel}
          aria-label={nextDeal ? `${nextLabel}: ${nextDeal.name}` : nextLabel}
          className={`${buttonBase} ${buttonEnabled}`}
        >
          {nextLabel}
        </a>
      ) : (
        <span aria-disabled="true" className={`${buttonBase} ${buttonDisabled}`}>
          {nextLabel}
        </span>
      )}
    </div>
  );
}
