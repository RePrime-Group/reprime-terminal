'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatPercent, formatPriceCompact } from '@/lib/utils/format';
import PhoneConfirmModal from '@/components/portal/PhoneConfirmModal';
import { friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';

interface Deal {
  id: string;
  name: string;
  city: string;
  state: string;
  property_type: string;
  purchase_price: string | null;
  irr: string | null;
  status: string;
}

interface Props {
  deals: Deal[];
  committedDealIds: string[];
  initialPhone: string;
  statusBadges: Record<string, { label: string; bg: string; text: string }>;
  defaultBadge: { label: string; bg: string; text: string };
}

export default function PortfolioList({
  deals: initialDeals,
  committedDealIds: initialCommittedIds,
  initialPhone,
  statusBadges,
  defaultBadge,
}: Props) {
  const router = useRouter();
  const t = useTranslations('portal.dealDetail');
  const [deals, setDeals] = useState(initialDeals);
  const [committedIds, setCommittedIds] = useState(new Set(initialCommittedIds));
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string>(initialPhone);

  const handleWithdraw = async (e164: string) => {
    if (!pendingDealId) return;
    setWithdrawing(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${pendingDealId}/commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164 }),
      });
      if (!res.ok) {
        setError(await readApiError(res, 'We couldn\u2019t process the withdrawal right now. Please try again, or contact RePrime if this keeps happening.'));
        return;
      }
      setPhone(e164);
      setCommittedIds((prev) => {
        const next = new Set(prev);
        next.delete(pendingDealId);
        return next;
      });
      // If the deal is only here because of the commitment, drop the row too.
      setDeals((prev) => prev.filter((d) => d.id !== pendingDealId || d.status === 'assigned'));
      setPendingDealId(null);
      router.refresh();
    } catch (err) {
      console.error('portfolio withdraw failed:', err);
      setError(friendlyFetchError(err, 'We couldn\u2019t process the withdrawal right now. Please try again.'));
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        {deals.map((deal) => {
          const badge = statusBadges[deal.status] ?? defaultBadge;
          const isCommitted = committedIds.has(deal.id);
          return (
            <div
              key={deal.id}
              className="relative bg-white rounded-lg shadow-sm border border-gray-100 px-4 md:px-5 py-4 flex items-center justify-between gap-3 md:gap-4 hover:border-[#BC9C45]/40 hover:shadow-md transition-all"
            >
              <Link
                href={`/portal/deals/${deal.id}`}
                className="absolute inset-0 rounded-lg"
                aria-label={deal.name}
              />
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-[44px] h-[44px] rounded-full bg-gradient-to-br from-[#0A1628] to-[#1E3A5F] flex items-center justify-center flex-shrink-0">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="4" y="2" width="16" height="20" rx="1" />
                    <path d="M9 22V12h6v10" />
                    <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#0A1628] truncate">
                    {deal.name}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {deal.city}, {deal.state} &middot; {deal.property_type}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 md:gap-6 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-gray-400 font-medium">INVESTED</p>
                  <p className="text-[14px] font-semibold text-[#0A1628]">
                    {formatPriceCompact(deal.purchase_price)}
                  </p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-gray-400 font-medium">IRR</p>
                  <p className="text-[14px] font-semibold text-[#0B8A4D]">
                    {formatPercent(deal.irr)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium ${badge.bg} ${badge.text}`}
                >
                  {badge.label}
                </span>
                {isCommitted && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setError(null);
                      setPendingDealId(deal.id);
                    }}
                    className="relative z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FCA5A5] bg-white text-[#DC2626] text-[11px] font-semibold hover:bg-[#FEF2F2] hover:border-[#DC2626] transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-9-9" />
                      <path d="M21 3v6h-6" />
                    </svg>
                    {t('withdraw')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PhoneConfirmModal
        open={pendingDealId !== null}
        initialE164={phone}
        submitting={withdrawing}
        error={error}
        title={t('withdrawConfirmTitle')}
        description={t('withdrawConfirmDesc')}
        confirmLabel={t('confirmWithdrawal')}
        confirmingLabel={t('withdrawing')}
        confirmTone="danger"
        onCancel={() => {
          if (withdrawing) return;
          setPendingDealId(null);
          setError(null);
        }}
        onConfirm={handleWithdraw}
      />
    </>
  );
}
