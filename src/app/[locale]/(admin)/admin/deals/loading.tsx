export default function AdminDealsLoading() {
  return (
    <div className="min-h-screen bg-rp-page-bg p-8">
      {/* Skeleton header */}
      <div className="mb-8">
        <div className="skeleton-shimmer bg-rp-gray-200 h-8 w-48 rounded-lg" />
      </div>

      {/* Skeleton table */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-rp-gray-200">
          <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-40 rounded" />
          <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-24 rounded" />
          <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-28 rounded" />
          <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-20 rounded" />
          <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-32 rounded" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-6 py-4 border-b border-rp-gray-100 last:border-b-0"
          >
            <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-40 rounded" />
            <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-24 rounded" />
            <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-28 rounded" />
            <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-20 rounded" />
            <div className="skeleton-shimmer bg-rp-gray-200 h-4 w-32 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
