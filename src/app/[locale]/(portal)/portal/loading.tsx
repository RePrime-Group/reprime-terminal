export default function PortalLoading() {
  return (
    <div className="min-h-screen bg-rp-page-bg p-8">
      {/* Skeleton header */}
      <div className="mb-8">
        <div className="skeleton-shimmer bg-rp-gray-200 h-8 w-64 rounded-lg mb-2" />
        <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-40 rounded" />
      </div>

      {/* Skeleton card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white border border-rp-gray-200 overflow-hidden"
          >
            {/* Photo area */}
            <div className="skeleton-shimmer bg-rp-gray-200 h-[200px] w-full" />

            {/* Body area */}
            <div className="p-4 space-y-3">
              <div className="skeleton-shimmer bg-rp-gray-200 h-5 w-3/4 rounded" />
              <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-full rounded" />
              <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-5/6 rounded" />
              <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
