'use client';

import { useCallback, useEffect, useState } from 'react';
import { friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';
import type { TeamPermissionKey } from '@/lib/types/database';

interface EnrichedRequest {
  id: string;
  investor_id: string;
  request_type: 'invite_limit' | 'permission';
  requested_total: number | null;
  target_user_id: string | null;
  permission_key: TeamPermissionKey | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  investor: { id: string; full_name: string; email: string; company_name: string | null; team_invite_limit: number } | null;
  target_user: { id: string; full_name: string; email: string } | null;
  reviewer: { id: string; full_name: string } | null;
}

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all';

export default function TeamRequestsClient() {
  const [status, setStatus] = useState<FilterStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<EnrichedRequest | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/team-requests?status=${status}`);
      if (!res.ok) {
        setError(await readApiError(res, 'We couldn\u2019t load team requests.'));
        return;
      }
      const body = (await res.json()) as { requests: EnrichedRequest[] };
      setRequests(body.requests);
    } catch (err) {
      setError(friendlyFetchError(err, 'We couldn\u2019t load team requests.'));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-rp-navy">Team Requests</h1>
        <p className="text-[13px] text-rp-gray-500 mt-1">
          Approve or reject investor requests for more invites or sub-user permission elevation.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {(['pending', 'approved', 'rejected', 'all'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3.5 py-1.5 text-[12px] font-semibold rounded-full border transition-colors ${
              status === s
                ? 'bg-rp-navy text-white border-rp-navy'
                : 'bg-white text-rp-gray-600 border-rp-gray-200 hover:border-rp-gray-300'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#DC2626] mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-[13px] text-rp-gray-500">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center text-[13px] text-rp-gray-500 bg-white rounded-xl border border-rp-gray-200">
          No {status === 'all' ? '' : status} requests.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-rp-gray-200 overflow-hidden">
          {requests.map((r, i) => (
            <div
              key={r.id}
              className={`flex flex-col md:flex-row md:items-center gap-3 px-4 py-4 ${
                i < requests.length - 1 ? 'border-b border-rp-gray-100' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#BC9C45] bg-[#FDF8ED] border border-[#ECD9A0] rounded px-1.5 py-0.5">
                    {r.request_type === 'invite_limit' ? 'Invite limit' : 'Permission'}
                  </span>
                  <StatusPill status={r.status} />
                </div>
                <div className="text-[14px] font-semibold text-rp-navy truncate">
                  {r.investor?.full_name ?? 'Unknown investor'}
                </div>
                <div className="text-[12px] text-rp-gray-500">
                  {r.investor?.email}
                  {r.investor?.company_name ? ` · ${r.investor.company_name}` : ''}
                </div>
                <div className="text-[12px] text-rp-gray-600 mt-1.5">
                  {r.request_type === 'invite_limit' ? (
                    <>
                      Wants limit raised to <strong>{r.requested_total}</strong>{' '}
                      (current: {r.investor?.team_invite_limit ?? '—'})
                    </>
                  ) : (
                    <>
                      Wants <strong>{r.permission_key?.replace(/_/g, ' ')}</strong> enabled for{' '}
                      <strong>{r.target_user?.full_name ?? 'team member'}</strong>{' '}
                      {r.target_user?.email ? `(${r.target_user.email})` : ''}
                    </>
                  )}
                </div>
                {r.reason && (
                  <div className="text-[12px] text-rp-gray-500 italic mt-1">&ldquo;{r.reason}&rdquo;</div>
                )}
                {r.admin_notes && r.status !== 'pending' && (
                  <div className="text-[11px] text-rp-gray-500 mt-1">
                    Admin note: {r.admin_notes}
                  </div>
                )}
                <div className="text-[11px] text-rp-gray-400 mt-1">
                  Submitted {new Date(r.created_at).toLocaleString()}
                  {r.reviewer && r.reviewed_at && (
                    <> · Reviewed by {r.reviewer.full_name} on {new Date(r.reviewed_at).toLocaleDateString()}</>
                  )}
                </div>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReviewing(r)}
                    className="px-3.5 py-2 rounded-lg bg-rp-navy text-white text-[12px] font-semibold hover:bg-rp-navy/90 transition-colors"
                  >
                    Review
                  </button>
                </div>
              )}
              {r.status === 'approved' &&
                r.request_type === 'permission' &&
                r.target_user_id &&
                r.permission_key && (
                  <div className="shrink-0">
                    <RevokePermissionButton
                      targetUserId={r.target_user_id}
                      permissionKey={r.permission_key}
                      targetName={r.target_user?.full_name ?? 'team member'}
                      onDone={load}
                    />
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <ReviewModal
          request={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RevokePermissionButton({
  targetUserId,
  permissionKey,
  targetName,
  onDone,
}: {
  targetUserId: string;
  permissionKey: TeamPermissionKey;
  targetName: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    const human = permissionKey.replace(/_/g, ' ');
    if (
      !confirm(
        `Revoke "${human}" for ${targetName}? The permission will be turned off immediately and the parent investor will need to re-request it.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team-members/${targetUserId}/revoke-permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_key: permissionKey }),
      });
      if (!res.ok) {
        setError(await readApiError(res, 'Failed to revoke permission.'));
        return;
      }
      onDone();
    } catch (err) {
      setError(friendlyFetchError(err, 'Failed to revoke permission.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={revoke}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-white border border-[#FECACA] text-[12px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors disabled:opacity-50"
      >
        {busy ? 'Revoking…' : 'Revoke permission'}
      </button>
      {error && <span className="text-[11px] text-[#DC2626]">{error}</span>}
    </div>
  );
}

function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const styles = {
    pending: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
    approved: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
    rejected: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
  }[status];
  return (
    <span className={`text-[10px] font-bold uppercase tracking-[0.12em] rounded px-1.5 py-0.5 border ${styles}`}>
      {status}
    </span>
  );
}

function ReviewModal({
  request,
  onClose,
  onDone,
}: {
  request: EnrichedRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approve' | 'reject') {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, admin_notes: notes.trim() || null }),
      });
      if (res.ok) {
        onDone();
      } else {
        setError(await readApiError(res, 'Failed to record decision.'));
      }
    } catch (err) {
      setError(friendlyFetchError(err, 'Failed to record decision.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-rp-gray-100">
          <h3 className="text-[16px] font-semibold text-rp-navy">
            {request.request_type === 'invite_limit' ? 'Review invite limit request' : 'Review permission request'}
          </h3>
        </div>
        <div className="p-5">
          <div className="text-[13px] text-rp-gray-700">
            From <strong>{request.investor?.full_name}</strong> ({request.investor?.email})
          </div>
          <div className="text-[13px] text-rp-gray-700 mt-2">
            {request.request_type === 'invite_limit' ? (
              <>
                Raise invite limit to <strong>{request.requested_total}</strong> (currently {request.investor?.team_invite_limit}).
              </>
            ) : (
              <>
                Enable <strong>{request.permission_key?.replace(/_/g, ' ')}</strong> for{' '}
                <strong>{request.target_user?.full_name}</strong>.
              </>
            )}
          </div>
          {request.reason && (
            <div className="text-[12px] text-rp-gray-500 italic mt-3 border-l-2 border-rp-gray-200 pl-3">
              &ldquo;{request.reason}&rdquo;
            </div>
          )}

          <label className="block mt-5">
            <span className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-rp-gray-500 mb-1.5">
              Admin note (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Reason or context visible to the investor"
              className="w-full px-3.5 py-2.5 rounded-lg border border-rp-gray-300 bg-white text-[13px] outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-all resize-none"
            />
          </label>

          {error && (
            <div className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#DC2626]">{error}</div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-rp-gray-100 flex justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-rp-gray-200 text-[13px] font-semibold text-rp-gray-600 hover:bg-rp-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => decide('reject')}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-white border border-[#FECACA] text-[13px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors disabled:opacity-40"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => decide('approve')}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-[#0B8A4D] text-white text-[13px] font-semibold hover:bg-[#097240] transition-colors disabled:opacity-40"
          >
            {submitting ? 'Working…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
