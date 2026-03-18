export default function PortalLoading() {
  return (
    <div className="px-6 py-8 max-w-[1600px] mx-auto">
      {/* Skeleton header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="skeleton-shimmer bg-rp-gray-200 h-8 w-64 rounded-lg" />
          <div className="skeleton-shimmer bg-rp-gray-200 h-6 w-20 rounded-full" />
        </div>
        <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-96 rounded mt-1" />
      </div>

      {/* Skeleton card grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(370px,1fr))] gap-5">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-[16px] bg-white border border-rp-gray-200 overflow-hidden"
          >
            {/* Photo area skeleton */}
            <div className="skeleton-shimmer bg-rp-gray-200 h-[200px] w-full rounded-t-[16px]" />

            {/* Body area */}
            <div className="p-5 space-y-4">
              {/* Deal name */}
              <div className="skeleton-shimmer bg-rp-gray-200 h-5 w-3/4 rounded" />

              {/* Subtitle (location + type) */}
              <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-full rounded" />

              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                {Array.from({ length: 6 }, (_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="skeleton-shimmer bg-rp-gray-200 h-3 w-12 rounded" />
                    <div className="skeleton-shimmer bg-rp-gray-200 h-5 w-16 rounded" />
                  </div>
                ))}
              </div>

              {/* Equity bar */}
              <div className="pt-2">
                <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-40 rounded" />
              </div>
            </div>

            {/* Countdown bar skeleton at bottom */}
            <div className="border-t border-rp-gray-200 px-5 py-3">
              <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-48 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
