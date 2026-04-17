'use client';

import { useCallback, useEffect, useState } from 'react';
import { PERMISSION_KEYS, APPROVAL_REQUIRED_KEYS } from '@/lib/auth/permissions';
import type { TeamPermissionKey, TeamPermissions } from '@/lib/types/database';
import { friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';

interface Member {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  company_name: string | null;
  permissions: TeamPermissions;
  is_active: boolean;
  created_at: string;
  last_active_at: string | null;
}

interface Invite {
  id: string;
  email: string;
  token: string;
  permissions: TeamPermissions;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface TeamRequest {
  id: string;
  request_type: 'invite_limit' | 'permission';
  target_user_id: string | null;
  permission_key: TeamPermissionKey | null;
  requested_total: number | null;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface ApiPayload {
  limit: number;
  used: number;
  members: Member[];
  invites: Invite[];
  requests: TeamRequest[];
}

const PERMISSION_LABELS: Record<TeamPermissionKey, { label: string; description: string }> = {
  view_deals: { label: 'View deals', description: 'Always on. Sub-users can browse all deals.' },
  manage_watchlist: { label: 'Manage watchlist', description: 'Add deals to watchlist and set notification preferences.' },
  commit_withdraw: { label: 'Commit to deals', description: 'Submit and withdraw commitments. Requires admin approval before enabling.' },
  download_documents: { label: 'Download documents', description: 'Download DD files and the Offering Memorandum.' },
  schedule_meetings: { label: 'Schedule meetings', description: 'Book meetings with the RePrime acquisitions team.' },
  message_team: { label: 'Send messages', description: 'Post messages in deal rooms.' },
};

export default function TeamMembersSection({ locale }: { locale: string }) {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showRequestMoreModal, setShowRequestMoreModal] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/team/members');
      if (!res.ok) {
        setError(await readApiError(res, 'We couldn\u2019t load your team. Please try again.'));
        return;
      }
      const body = (await res.json()) as ApiPayload;
      setData(body);
    } catch (err) {
      setError(friendlyFetchError(err, 'We couldn\u2019t load your team. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingPermissionRequests = new Set(
    (data?.requests ?? [])
      .filter((r) => r.request_type === 'permission' && r.status === 'pending' && r.target_user_id && r.permission_key)
      .map((r) => `${r.target_user_id}:${r.permission_key}`),
  );

  const pendingInviteLimitRequest = (data?.requests ?? []).find(
    (r) => r.request_type === 'invite_limit' && r.status === 'pending',
  );

  const canInvite = data ? data.used < data.limit : false;

  return (
    <section className="bg-white rounded-xl border border-[#EEF0F4] p-5 md:p-7 mb-5 md:mb-6 rp-card-shadow">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-[17px] md:text-[19px] font-semibold text-[#0E3470]">Team Members</h2>
          <p className="text-[12px] text-[#6B7280] mt-1">
            Invite colleagues, employees, or partners to use RePrime on your behalf. You control what each can do.
          </p>
        </div>
        {data && (
          <div className="text-[12px] text-[#6B7280] bg-[#F9FAFB] border border-[#EEF0F4] rounded-lg px-3 py-1.5 shrink-0">
            <span className="font-semibold text-[#0F1B2D]">{data.used}</span>
            <span className="mx-1">of</span>
            <span className="font-semibold text-[#0F1B2D]">{data.limit}</span>
            <span className="ml-1">invites used</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="py-10 text-center text-[13px] text-[#6B7280]">Loading your team…</div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#DC2626]">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              disabled={!canInvite}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0E3470] text-white text-[13px] font-semibold hover:bg-[#0a2856] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Invite team member
            </button>
            <button
              type="button"
              onClick={() => setShowRequestMoreModal(true)}
              disabled={!!pendingInviteLimitRequest}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-transparent border border-[#BC9C45]/40 text-[#BC9C45] text-[13px] font-semibold hover:bg-[#BC9C45]/5 transition-colors disabled:opacity-50"
              title={pendingInviteLimitRequest ? 'You already have a pending request.' : 'Ask RePrime to raise your invite limit'}
            >
              {pendingInviteLimitRequest ? 'Request pending…' : 'Request more'}
            </button>
          </div>

          {/* Active + inactive members */}
          {data.members.length > 0 && (
            <div className="mb-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280] mb-2">
                Your team
              </div>
              <div className="border border-[#EEF0F4] rounded-xl overflow-hidden">
                {data.members.map((m, i) => {
                  const enabledCount = Object.values(m.permissions).filter(Boolean).length;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 ${
                        i < data.members.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                      } ${!m.is_active ? 'bg-[#FAFAFA]' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[14px] font-semibold ${m.is_active ? 'text-[#0F1B2D]' : 'text-[#9CA3AF] line-through'}`}>
                            {m.full_name}
                          </span>
                          {!m.is_active && (
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280] bg-[#F3F4F6] rounded px-1.5 py-0.5">
                              Revoked
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-[#6B7280] truncate">{m.email}</div>
                        <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                          {enabledCount} permission{enabledCount === 1 ? '' : 's'} enabled
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.is_active ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingMember(m)}
                              className="px-3 py-1.5 text-[12px] font-semibold text-[#0E3470] hover:bg-[#F3F4F6] rounded-md transition-colors"
                            >
                              Edit access
                            </button>
                            <RevokeButton memberId={m.id} onDone={load} />
                          </>
                        ) : (
                          <ReactivateButton memberId={m.id} onDone={load} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending invites */}
          {data.invites.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280] mb-2">
                Pending invites
              </div>
              <div className="border border-[#EEF0F4] rounded-xl overflow-hidden">
                {data.invites.map((inv, i) => (
                  <div
                    key={inv.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 ${
                      i < data.invites.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-[#0F1B2D] truncate">{inv.email}</div>
                      <div className="text-[11px] text-[#9CA3AF] mt-0.5">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ResendInviteButton inviteId={inv.id} locale={locale} onDone={load} />
                      <CancelInviteButton inviteId={inv.id} onDone={load} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.members.length === 0 && data.invites.length === 0 && (
            <div className="py-8 text-center text-[13px] text-[#9CA3AF]">
              You haven&rsquo;t invited any team members yet.
            </div>
          )}
        </>
      )}

      {showInviteModal && (
        <InviteTeamMemberModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            load();
          }}
          locale={locale}
        />
      )}

      {editingMember && (
        <EditPermissionsModal
          member={editingMember}
          pendingRequests={pendingPermissionRequests}
          onClose={() => setEditingMember(null)}
          onSuccess={() => {
            setEditingMember(null);
            load();
          }}
        />
      )}

      {showRequestMoreModal && data && (
        <RequestMoreModal
          currentLimit={data.limit}
          onClose={() => setShowRequestMoreModal(false)}
          onSuccess={() => {
            setShowRequestMoreModal(false);
            load();
          }}
        />
      )}
    </section>
  );
}

// ---------- Sub-components ----------

function InviteTeamMemberModal({
  onClose,
  onSuccess,
  locale,
}: {
  onClose: () => void;
  onSuccess: () => void;
  locale: string;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState<TeamPermissions>({
    view_deals: true,
    manage_watchlist: true,
    commit_withdraw: false,
    download_documents: false,
    schedule_meetings: false,
    message_team: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!fullName.trim()) {
      setError('Please enter a name.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), full_name: fullName.trim(), permissions, locale }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        setError(await readApiError(res, 'We couldn\u2019t send the invite. Please try again.'));
      }
    } catch (err) {
      setError(friendlyFetchError(err, 'We couldn\u2019t send the invite. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Invite team member" onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LabeledInput label="Full name" value={fullName} onChange={setFullName} placeholder="Jane Doe" />
        <LabeledInput label="Email" type="email" value={email} onChange={setEmail} placeholder="jane@example.com" />
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280] mb-2">
          Initial permissions
        </div>
        <div className="space-y-1">
          {PERMISSION_KEYS.map((key) => {
            const locked = key === 'view_deals' || APPROVAL_REQUIRED_KEYS.includes(key);
            const checked = permissions[key] ?? false;
            const disabledReason =
              key === 'view_deals'
                ? 'Always enabled'
                : APPROVAL_REQUIRED_KEYS.includes(key)
                  ? 'Requires admin approval — request after invite is accepted'
                  : '';
            return (
              <div
                key={key}
                className={`flex items-start gap-3 py-2.5 ${
                  locked ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={(e) => setPermissions((p) => ({ ...p, [key]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB] text-[#0E3470] focus:ring-[#BC9C45]/30"
                />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-[#0F1B2D]">{PERMISSION_LABELS[key].label}</div>
                  <div className="text-[11px] text-[#6B7280]">
                    {disabledReason || PERMISSION_LABELS[key].description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#DC2626]">
          {error}
        </div>
      )}

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[13px] font-semibold text-[#4B5563] hover:bg-[#F9FAFB] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-[#0E3470] text-white text-[13px] font-semibold hover:bg-[#0a2856] transition-colors disabled:opacity-40"
        >
          {submitting ? 'Sending…' : 'Send invite'}
        </button>
      </ModalActions>
    </ModalShell>
  );
}

function EditPermissionsModal({
  member,
  pendingRequests,
  onClose,
  onSuccess,
}: {
  member: Member;
  pendingRequests: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [permissions, setPermissions] = useState<TeamPermissions>({ ...member.permissions });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestingKey, setRequestingKey] = useState<TeamPermissionKey | null>(null);

  async function save() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/team/members/${member.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        setError(await readApiError(res, 'We couldn\u2019t update permissions. Please try again.'));
      }
    } catch (err) {
      setError(friendlyFetchError(err, 'We couldn\u2019t update permissions. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function requestApproval(key: TeamPermissionKey) {
    setError(null);
    setRequestingKey(key);
    try {
      const res = await fetch('/api/team/request-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: member.id, permission_key: key }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        setError(await readApiError(res, 'We couldn\u2019t submit your request.'));
      }
    } catch (err) {
      setError(friendlyFetchError(err, 'We couldn\u2019t submit your request.'));
    } finally {
      setRequestingKey(null);
    }
  }

  return (
    <ModalShell title={`Edit access — ${member.full_name}`} onClose={onClose}>
      <div className="space-y-1">
        {PERMISSION_KEYS.map((key) => {
          const alwaysOn = key === 'view_deals';
          const needsApproval = APPROVAL_REQUIRED_KEYS.includes(key);
          const currentlyOn = member.permissions[key] === true;
          const newValue = permissions[key] ?? false;
          const hasPending = pendingRequests.has(`${member.id}:${key}`);
          // For approval-required keys: user cannot toggle ON unless currently approved (i.e. already on).
          // We infer "approved" by the current state — if it's already on, parent has full control.
          const needsRequestToEnable = needsApproval && !currentlyOn && !alwaysOn;

          return (
            <div key={key} className="flex items-start gap-3 py-2.5 border-b border-[#F3F4F6] last:border-b-0">
              <input
                type="checkbox"
                checked={alwaysOn ? true : newValue}
                disabled={alwaysOn || needsRequestToEnable}
                onChange={(e) => setPermissions((p) => ({ ...p, [key]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB] text-[#0E3470] focus:ring-[#BC9C45]/30 disabled:opacity-50"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-[#0F1B2D]">{PERMISSION_LABELS[key].label}</span>
                  {alwaysOn && (
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280] bg-[#F3F4F6] rounded px-1.5 py-0.5">
                      Always
                    </span>
                  )}
                  {needsRequestToEnable && !hasPending && (
                    <button
                      type="button"
                      onClick={() => requestApproval(key)}
                      disabled={requestingKey === key}
                      className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#BC9C45] hover:text-[#A6883C] underline decoration-dotted underline-offset-2 disabled:opacity-50"
                    >
                      {requestingKey === key ? 'Requesting…' : 'Request approval'}
                    </button>
                  )}
                  {hasPending && (
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#92400E] bg-[#FEF3C7] rounded px-1.5 py-0.5">
                      Pending admin approval
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#6B7280] mt-0.5">{PERMISSION_LABELS[key].description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#DC2626]">
          {error}
        </div>
      )}

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[13px] font-semibold text-[#4B5563] hover:bg-[#F9FAFB] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-[#0E3470] text-white text-[13px] font-semibold hover:bg-[#0a2856] transition-colors disabled:opacity-40"
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </ModalActions>
    </ModalShell>
  );
}

function RequestMoreModal({
  currentLimit,
  onClose,
  onSuccess,
}: {
  currentLimit: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [requestedTotal, setRequestedTotal] = useState(currentLimit + 5);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (requestedTotal <= currentLimit) {
      setError(`Please request a total higher than your current limit (${currentLimit}).`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/team/request-more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requested_total: requestedTotal, reason: reason.trim() || null }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        setError(await readApiError(res, 'We couldn\u2019t submit your request.'));
      }
    } catch (err) {
      setError(friendlyFetchError(err, 'We couldn\u2019t submit your request.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Request more invites" onClose={onClose}>
      <p className="text-[13px] text-[#4B5563] mb-4">
        Your current limit is <strong>{currentLimit}</strong>. Ask RePrime to raise it and let us know why.
      </p>

      <LabeledInput
        label="Requested total"
        type="number"
        value={String(requestedTotal)}
        onChange={(v) => setRequestedTotal(Math.max(currentLimit + 1, Number(v) || currentLimit + 1))}
      />

      <div className="mt-4">
        <label className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6B7280] mb-1.5">
          Reason (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Briefly, why do you need more?"
          className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#0F1B2D] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#C8A951]/20 focus:border-[#C8A951] transition-all resize-none"
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#DC2626]">{error}</div>
      )}

      <ModalActions>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[13px] font-semibold text-[#4B5563] hover:bg-[#F9FAFB] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-[#0E3470] text-white text-[13px] font-semibold hover:bg-[#0a2856] transition-colors disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </ModalActions>
    </ModalShell>
  );
}

function RevokeButton({ memberId, onDone }: { memberId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm('Revoke this team member\u2019s access? They won\u2019t be able to sign in until you reactivate them.')) return;
        setBusy(true);
        try {
          await fetch(`/api/team/members/${memberId}/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reactivate: false }),
          });
          onDone();
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors disabled:opacity-50"
    >
      {busy ? '…' : 'Revoke'}
    </button>
  );
}

function ReactivateButton({ memberId, onDone }: { memberId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(`/api/team/members/${memberId}/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reactivate: true }),
          });
          onDone();
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="px-3 py-1.5 text-[12px] font-semibold text-[#0B8A4D] hover:bg-[#ECFDF5] rounded-md transition-colors disabled:opacity-50"
    >
      {busy ? '…' : 'Reactivate'}
    </button>
  );
}

function ResendInviteButton({ inviteId, locale, onDone }: { inviteId: string; locale: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent'>('idle');
  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/team/invites/${inviteId}/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ locale }),
          });
          if (res.ok) {
            setStatus('sent');
            setTimeout(() => setStatus('idle'), 2000);
            onDone();
          }
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="px-3 py-1.5 text-[12px] font-semibold text-[#0E3470] hover:bg-[#F3F4F6] rounded-md transition-colors disabled:opacity-50"
    >
      {status === 'sent' ? '✓ Sent' : busy ? '…' : 'Resend'}
    </button>
  );
}

function CancelInviteButton({ inviteId, onDone }: { inviteId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm('Cancel this pending invite?')) return;
        setBusy(true);
        try {
          await fetch(`/api/team/invites/${inviteId}`, { method: 'DELETE' });
          onDone();
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors disabled:opacity-50"
    >
      {busy ? '…' : 'Cancel'}
    </button>
  );
}

// ---------- Modal primitives ----------

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#EEF0F4]">
          <h3 className="text-[16px] font-semibold text-[#0E3470]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6B7280] mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#0F1B2D] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#C8A951]/20 focus:border-[#C8A951] transition-all"
      />
    </label>
  );
}
