// Loading skeleton for /portal and /portal/marketplace (marketplace has no own
// loading.tsx, so it inherits this). Mirrors the page structure — header, metric
// tiles, filter bar, deal-card grid — in a neutral grey palette (no brand colours
// while loading, so there's no jarring colour flash before content paints).

function MetricTileSkeleton() {
  return (
    <div className="rounded-xl border border-[#EEF0F4] bg-white p-4 md:p-5 space-y-3">
      <div className="skeleton-shimmer bg-rp-gray-200 h-3 w-20 rounded" />
      <div className="skeleton-shimmer bg-rp-gray-200 h-6 w-24 rounded" />
    </div>
  );
}

function DealCardSkeleton() {
  return (
    <div className="rounded-[16px] bg-white border border-[#EEF0F4] overflow-hidden">
      {/* Photo */}
      <div className="skeleton-shimmer bg-rp-gray-200 h-[200px] w-full" />
      {/* Body */}
      <div className="p-5 space-y-4">
        <div className="skeleton-shimmer bg-rp-gray-200 h-6 w-3/4 rounded" />
        <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-1/2 rounded" />
        <div className="grid grid-cols-3 gap-3 pt-1">
          {Array.from({ length: 6 }, (_, j) => (
            <div key={j} className="space-y-1.5">
              <div className="skeleton-shimmer bg-rp-gray-200 h-3 w-12 rounded" />
              <div className="skeleton-shimmer bg-rp-gray-200 h-5 w-16 rounded" />
            </div>
          ))}
        </div>
        <div className="skeleton-shimmer bg-rp-gray-200 h-3 w-32 rounded" />
      </div>
      {/* Countdown bar */}
      <div className="border-t border-[#EEF0F4] px-5 py-3">
        <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-40 rounded" />
      </div>
    </div>
  );
}

export default function PortalLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-3">
          <div className="skeleton-shimmer bg-rp-gray-200 h-9 md:h-11 w-64 md:w-80 rounded-lg" />
          <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-72 max-w-full rounded" />
        </div>
        <div className="skeleton-shimmer bg-rp-gray-200 hidden md:block h-9 w-28 rounded-lg shrink-0" />
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {Array.from({ length: 6 }, (_, i) => (
          <MetricTileSkeleton key={i} />
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] rp-card-shadow px-4 md:px-5 py-3.5 flex flex-wrap items-center gap-3 mb-6">
        <div className="skeleton-shimmer bg-rp-gray-200 h-9 w-full md:w-[300px] rounded-lg" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton-shimmer bg-rp-gray-200 h-8 w-20 rounded-lg hidden md:block" />
        ))}
      </div>

      {/* Deal grid */}
      <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-5 md:gap-7">
        {Array.from({ length: 6 }, (_, i) => (
          <DealCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
