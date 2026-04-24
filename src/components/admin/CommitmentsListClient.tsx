'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { friendlyFetchError } from '@/lib/utils/friendly-error';

interface CommitmentRow {
  id: string;
  type: string;
  status: string;
  created_at: string;
  investor_name: string;
  investor_email: string;
  deal_name: string;
  deal_location: string;
}

type StatusFilter = 'all' | 'pending' | 'wire_sent' | 'confirmed' | 'cancelled';

interface CommitmentsListClientProps {
  commitments: CommitmentRow[];
  total: number;
  page: number;
  statusFilter: StatusFilter;
  counts: Record<StatusFilter, number>;
  locale: string;
  pageSize: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  wire_sent: 'bg-blue-50 text-blue-700 border border-blue-200',
  confirmed: 'bg-green-50 text-green-700 border border-green-200',
  cancelled: 'bg-red-50 text-red-500 border border-red-200',
};

const typeStyles: Record<string, string> = {
  primary: 'bg-[#BC9C45]/10 text-[#BC9C45] border border-[#BC9C45]/20',
  backup: 'bg-[#0E3470]/10 text-[#0E3470] border border-[#0E3470]/20',
};

export default function CommitmentsListClient({
  commitments,
  total,
  page,
  statusFilter,
  counts,
  locale,
  pageSize,
}: CommitmentsListClientProps) {
  const router = useRouter();
  const t = useTranslations('admin.commitments');
  const tc = useTranslations('common');
  const totalPages = Math.ceil(total / pageSize);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    pending: t('pending'),
    wire_sent: t('wireSent'),
    confirmed: t('confirmed'),
    cancelled: t('cancelled'),
  };

  const filterLabels: Record<StatusFilter, string> = {
    all: t('all'),
    pending: t('pending'),
    wire_sent: t('wireSent'),
    confirmed: t('confirmed'),
    cancelled: t('cancelled'),
  };

  const navigate = (newPage: number, newStatus?: StatusFilter) => {
    const status = newStatus ?? statusFilter;
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (newPage > 1) params.set('p', String(newPage));
    const qs = params.toString();
    router.push(`/${locale}/admin/commitments${qs ? `?${qs}` : ''}`);
  };

  const handleCancel = async (id: string) => {
    setCancelError(null);
    setCancellingId(id);
    try {
      const res = await fetch(`/api/admin/commitments/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCancelError(data?.error ?? 'Could not cancel. Try again.');
        return;
      }
      setConfirmId(null);
      router.refresh();
    } catch (err) {
      setCancelError(friendlyFetchError(err, 'Could not cancel. Try again.'));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-[28px] font-semibold text-[#0E3470]">
            {t('title')}
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            {t('total', { count: total })}
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(Object.keys(filterLabels) as StatusFilter[]).map((key) => (
          <button
            key={key}
            onClick={() => navigate(1, key)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
              statusFilter === key
                ? 'bg-[#0E3470] text-white'
                : 'bg-white border border-[#EEF0F4] text-[#6B7280] hover:border-[#BC9C45] hover:text-[#0E3470]'
            }`}
          >
            {filterLabels[key]}
            <span className="ml-1.5 opacity-60">{counts[key]}</span>
          </button>
        ))}
      </div>

      {cancelError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-700">
          {cancelError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] overflow-hidden rp-card-shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#EEF0F4] bg-[#F7F8FA]">
              <th className="text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] px-5 py-3">{t('investor')}</th>
              <th className="text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] px-5 py-3">{t('deal')}</th>
              <th className="text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] px-5 py-3">{t('type')}</th>
              <th className="text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] px-5 py-3">{t('status')}</th>
              <th className="text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] px-5 py-3">{t('date')}</th>
              <th className="text-right text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] px-5 py-3">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {commitments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#9CA3AF] text-sm">
                  {t('noCommitmentsFound')}
                </td>
              </tr>
            ) : (
              commitments.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[#EEF0F4] last:border-b-0 hover:bg-[#F7F8FA]/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="text-[13px] font-semibold text-[#0E3470]">{c.investor_name}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{c.investor_email}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-[13px] font-medium text-[#0E3470]">{c.deal_name}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{c.deal_location}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${typeStyles[c.type] ?? 'bg-gray-50 text-gray-500'}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full ${statusStyles[c.status] ?? 'bg-gray-50 text-gray-500'}`}>
                      {statusLabels[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[12px] text-[#6B7280]">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {c.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelError(null);
                          setConfirmId(c.id);
                        }}
                        disabled={cancellingId === c.id}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50"
                      >
                        {cancellingId === c.id ? t('cancelling') : t('cancel')}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirm modal */}
      {confirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => {
            if (cancellingId) return;
            setConfirmId(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-[#0E3470]">
              {t('confirmCancelTitle')}
            </h3>
            <p className="mt-2 text-[13px] text-[#6B7280]">
              {t('confirmCancelBody')}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                disabled={cancellingId !== null}
                className="rounded-md border border-[#EEF0F4] px-3 py-1.5 text-[12px] font-medium text-[#6B7280] hover:border-[#BC9C45] hover:text-[#0E3470] transition-colors disabled:opacity-50"
              >
                {tc('cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleCancel(confirmId)}
                disabled={cancellingId !== null}
                className="rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancellingId ? t('cancelling') : t('confirmCancelAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <span className="text-[12px] text-[#9CA3AF]">
            {tc('page')} {page} {tc('of')} {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(page - 1)}
              disabled={page <= 1}
              className="px-4 py-2 rounded-lg border border-[#EEF0F4] text-[12px] font-medium text-[#6B7280] hover:border-[#BC9C45] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {tc('previous')}
            </button>
            <button
              onClick={() => navigate(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-lg border border-[#EEF0F4] text-[12px] font-medium text-[#6B7280] hover:border-[#BC9C45] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {tc('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
