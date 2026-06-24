'use client';

import { useTranslations } from 'next-intl';
import type { MatchedListing } from '@/lib/portal/types';

interface Props {
  listings: MatchedListing[];
  total: number;
  offset: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  alreadyPromoted: Set<string>;
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onPromote: () => void;
  onPrev: () => void;
  onNext: () => void;
  portalBaseUrl: string;
}

export default function MatchedListingsList({
  listings,
  total,
  offset,
  pageSize,
  currentPage,
  totalPages,
  alreadyPromoted,
  selectedIds,
  onSelectionChange,
  onPromote,
  onPrev,
  onNext,
  portalBaseUrl,
}: Props) {
  const t = useTranslations('admin.sourcing');

  if (listings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-8 text-center text-sm text-rp-gray-500">
        {t('noResults')}
      </div>
    );
  }

  const allSelectableIds = listings
    .map((l) => l.listing_id)
    .filter((id) => !alreadyPromoted.has(id));
  const allOnPageSelected =
    allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedIds.has(id));

  const toggleAllOnPage = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) {
      allSelectableIds.forEach((id) => next.delete(id));
    } else {
      allSelectableIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-rp-gray-100">
        <div className="text-sm text-rp-gray-600">
          {t('resultsCount', {
            from: offset + 1,
            to: offset + listings.length,
            total,
          })}
          {selectedIds.size > 0 && (
            <span className="ml-3 text-rp-gold font-semibold">
              {t('selectedCount', { n: selectedIds.size })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAllOnPage}
            disabled={allSelectableIds.length === 0}
            className="text-[12px] px-2 py-1 rounded-md text-rp-gray-500 hover:bg-rp-gray-100 disabled:opacity-50"
          >
            {allOnPageSelected ? t('deselectPage') : t('selectPage')}
          </button>
          <button
            type="button"
            onClick={onPromote}
            disabled={selectedIds.size === 0}
            className="text-[12px] px-3 py-1.5 rounded-md bg-rp-navy text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {t('promoteSelected')} ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* List */}
      <ul className="divide-y divide-rp-gray-100">
        {listings.map((l) => {
          const isPromoted = alreadyPromoted.has(l.listing_id);
          const isSelected = selectedIds.has(l.listing_id);
          const primary = l.primary_property;
          return (
            <li
              key={l.listing_id}
              className={`flex items-start gap-3 px-4 py-3 ${isSelected ? 'bg-rp-gold-bg/30' : ''}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isPromoted}
                onChange={() => toggleOne(l.listing_id)}
                className="mt-1.5 w-4 h-4 rounded accent-rp-gold disabled:opacity-30"
              />

              {/* Thumb */}
              <div className="w-16 h-16 rounded-md bg-rp-gray-100 overflow-hidden flex-shrink-0">
                {l.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.images[0]}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-rp-gray-400 text-[10px]">
                    {t('noImage')}
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={l.listing_url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-rp-navy hover:text-rp-gold truncate"
                  >
                    {l.listing_title}
                  </a>
                  {l.is_portfolio && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-rp-navy/10 text-rp-navy">
                      {t('portfolioBadge', { n: l.property_count })}
                    </span>
                  )}
                  {isPromoted && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-rp-green-light text-rp-green">
                      {t('alreadyDealBadge')}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-rp-gray-500 mt-0.5">
                  {primary
                    ? `${[primary.city, primary.state].filter(Boolean).join(', ')}${primary.address ? ` — ${primary.address}` : ''}`
                    : '—'}
                  {primary?.property_type ? ` • ${primary.property_type}` : ''}
                </div>
                <div className="text-[12px] text-rp-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
                  {l.asking_price != null && <span>{t('lblPrice')}: {money(l.asking_price)}</span>}
                  {l.cap_rate != null && <span>{t('lblCap')}: {l.cap_rate}%</span>}
                  {l.occupancy != null && <span>{t('lblOcc')}: {l.occupancy}%</span>}
                  {l.total_building_size_sf != null && (
                    <span>{int(l.total_building_size_sf)} sf</span>
                  )}
                  {l.price_per_sf != null && <span>${l.price_per_sf.toFixed(0)}/sf</span>}
                </div>
                {portalBaseUrl && (
                  <div className="mt-1.5">
                    <a
                      href={`${portalBaseUrl}/listings/${l.listing_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-rp-gold hover:underline font-medium"
                    >
                      {t('openInPortal')} ↗
                    </a>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-rp-gray-100 text-sm">
          <span className="text-rp-gray-500">
            {t('pageXofY', { page: currentPage, total: totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={offset === 0}
              className="px-3 py-1.5 rounded-md border border-rp-gray-200 text-rp-navy disabled:opacity-30"
            >
              {t('prev')}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={offset + pageSize >= total}
              className="px-3 py-1.5 rounded-md border border-rp-gray-200 text-rp-navy disabled:opacity-30"
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
function int(n: number): string {
  return n.toLocaleString('en-US');
}
