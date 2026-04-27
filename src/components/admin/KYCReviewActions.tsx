'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface KYCReviewActionsProps {
  investorId: string;
  approved: boolean;
  rejected: boolean;
}

export default function KYCReviewActions({ investorId, approved, rejected }: KYCReviewActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState('');

  const approve = async () => {
    if (busy) return;
    setError('');
    setBusy('approve');
    try {
      const res = await fetch(`/api/admin/investors/${investorId}/kyc/approve`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Failed to approve.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (busy) return;
    setError('');
    setBusy('reject');
    try {
      const res = await fetch(`/api/admin/investors/${investorId}/kyc/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? 'Failed to reject.');
        return;
      }
      setShowRejectForm(false);
      setReason('');
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {!approved && (
          <button
            onClick={approve}
            disabled={!!busy}
            className="px-5 py-2.5 rounded-lg bg-[#166534] hover:bg-[#14532D] text-white text-[12px] font-bold transition-colors disabled:opacity-50"
          >
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
        )}
        {!rejected && (
          <button
            onClick={() => setShowRejectForm((v) => !v)}
            disabled={!!busy}
            className="px-5 py-2.5 rounded-lg border border-[#FECACA] text-[#991B1B] hover:bg-[#FEE2E2] text-[12px] font-bold transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>

      {showRejectForm && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3">
          <label className="block text-[11px] font-medium text-[#7F1D1D] mb-1">Rejection reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full text-[13px] bg-white border border-[#FECACA] rounded-lg p-2 text-[#0E3470]"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={reject}
              disabled={!!busy}
              className="px-4 py-2 rounded-lg bg-[#991B1B] hover:bg-[#7F1D1D] text-white text-[11px] font-bold transition-colors disabled:opacity-50"
            >
              {busy === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              disabled={!!busy}
              className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-[#6B7280] text-[11px] font-medium hover:bg-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-[11px] text-[#991B1B]">{error}</div>
      )}
    </div>
  );
}
