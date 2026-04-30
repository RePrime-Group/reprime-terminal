import React from 'react';

type BadgeVariant = 'draft' | 'published' | 'under_review' | 'assigned' | 'closed' | 'coming_soon' | 'loi_signed' | 'marketplace' | 'cancelled';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  draft: 'bg-rp-gray-200 text-rp-gray-600',
  published: 'bg-rp-green-light text-rp-green',
  under_review: 'bg-rp-amber-light text-rp-amber',
  assigned: 'bg-rp-gold-bg text-rp-gold',
  closed: 'bg-rp-navy/10 text-rp-navy',
  coming_soon: 'bg-rp-navy/[0.06] text-rp-navy border border-rp-navy/[0.12]',
  loi_signed: 'bg-rp-gold/10 text-rp-gold border border-rp-gold/20',
  marketplace: 'bg-[#ECFDFD] text-[#0E7490] border border-[#0E7490]/20',
  cancelled: 'bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20',
};

export default function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex px-2.5 py-1 rounded-full text-xs font-semibold
        ${variantStyles[variant]}
        ${className}
      `.trim()}
    >
      {children}
    </span>
  );
}
