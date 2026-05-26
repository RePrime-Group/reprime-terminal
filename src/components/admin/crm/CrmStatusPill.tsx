import type { CrmInvestorStatus } from '@/lib/types/database';
import { STATUS_MAP } from './CrmConstants';

export default function CrmStatusPill({
  status,
  className = '',
}: {
  status: CrmInvestorStatus;
  className?: string;
}) {
  const opt = STATUS_MAP[status];
  if (!opt) return null;
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${opt.pill} ${className}`.trim()}
    >
      {opt.label}
    </span>
  );
}
