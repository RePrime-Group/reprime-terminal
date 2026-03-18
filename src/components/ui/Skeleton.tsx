import React from 'react';

type SkeletonVariant = 'text' | 'card' | 'row';

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  count?: number;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded',
  card: 'h-48 rounded-2xl',
  row: 'h-12 rounded-lg',
};

function SkeletonItem({ variant = 'text', className = '' }: Omit<SkeletonProps, 'count'>) {
  return (
    <div
      className={`
        skeleton-shimmer bg-rp-gray-200
        ${variantStyles[variant]}
        ${className}
      `.trim()}
    />
  );
}

export default function Skeleton({ variant = 'text', className = '', count = 1 }: SkeletonProps) {
  if (count === 1) {
    return <SkeletonItem variant={variant} className={className} />;
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonItem key={i} variant={variant} className={className} />
      ))}
    </div>
  );
}
