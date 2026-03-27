'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface ApplicationRow {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  status: string;
  created_at: string;
}

interface ApplicationDetail extends ApplicationRow {
  phone: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface ApplicationsListClientProps {
  applications: ApplicationRow[];
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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-green-50 text-green-700 border border-green-200',
  rejected: 'bg-red-50 text-red-500 border border-red-200',
};

const filterLabels: Record<StatusFilter, string> = {
  all: 'All Applications',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-rp-gray-200">
      <p className="text-xs text-rp-gray-400">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-rp-gray-200 text-rp-gray-600 hover:bg-rp-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-rp-gray-200 text-rp-gray-600 hover:bg-rp-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ── Detail Modal ──
function ApplicationDetailModal({
  applicationId,
  onClose,
  onSaved,
}: {
  applicationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (cancelled) return;
        setDetail(data);
        setStatus(data.status);
        setNotes(data.admin_notes || '');
      } catch {
        if (!cancelled) setError('Failed to load application details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applicationId]);

  const hasChanges = detail ? (status !== detail.status || notes !== (detail.admin_notes || '')) : false;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: notes }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || 'Failed to save');
      } else {
        onSaved();
      }
    } catch {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-rp-navy/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl border border-rp-gray-200 shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Gold accent */}
        <div className="h-1 bg-gradient-to-r from-rp-gold to-[#D4B96A]" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-lg font-bold text-rp-navy">Application Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-rp-gray-400 hover:bg-rp-gray-100 hover:text-rp-gray-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-rp-gold/30 border-t-rp-gold rounded-full animate-spin" />
            </div>
          ) : !detail ? (
            <p className="text-sm text-red-600 text-center py-8">{error || 'Application not found'}</p>
          ) : (
            <>
              {/* Applicant info */}
              <div className="bg-rp-page-bg rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rp-navy flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-medium">
                      {detail.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-rp-navy">{detail.full_name}</p>
                    <p className="text-xs text-rp-gray-500">{detail.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-rp-gray-200">
                  <div>
                    <p className="text-[10px] font-semibold text-rp-gray-400 uppercase tracking-wider mb-0.5">Company</p>
                    <p className="text-sm text-rp-gray-700">{detail.company_name || '\u2014'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-rp-gray-400 uppercase tracking-wider mb-0.5">Phone</p>
                    <p className="text-sm text-rp-gray-700">{detail.phone || '\u2014'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-rp-gray-400 uppercase tracking-wider mb-0.5">Applied</p>
                    <p className="text-sm text-rp-gray-700">{formatDateTime(detail.created_at)}</p>
                  </div>
                  {detail.reviewed_at && (
                    <div>
                      <p className="text-[10px] font-semibold text-rp-gray-400 uppercase tracking-wider mb-0.5">Reviewed</p>
                      <p className="text-sm text-rp-gray-700">{formatDateTime(detail.reviewed_at)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <div className="flex gap-2">
                  {(['pending', 'approved', 'rejected'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        status === s
                          ? s === 'pending'
                            ? 'bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-200'
                            : s === 'approved'
                              ? 'bg-green-50 text-green-700 border-green-300 ring-2 ring-green-200'
                              : 'bg-red-50 text-red-600 border-red-300 ring-2 ring-red-200'
                          : 'bg-white text-rp-gray-500 border-rp-gray-200 hover:bg-rp-gray-50'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                {status === 'approved' && detail.status !== 'approved' && (
                  <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    Approving this application will automatically send an invitation to the applicant.
                  </p>
                )}
                {status === 'rejected' && detail.status !== 'rejected' && (
                  <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    Rejecting this application will send a rejection notification to the applicant.
                  </p>
                )}
              </div>

              {/* Admin Notes */}
              <div>
                <label className="block text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider mb-1.5">
                  Admin Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes about this application..."
                  className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 placeholder:text-rp-gray-400 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-rp-gray-200 text-sm font-medium text-rp-gray-600 hover:bg-rp-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-rp-gold text-white text-sm font-semibold hover:bg-rp-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──
export default function ApplicationsListClient({
  applications,
  total,
  page,
  statusFilter,
  counts,
  locale,
  pageSize,
}: ApplicationsListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handlePageChange = (p: number) => {
    updateParams({ p: String(p) });
  };

  const handleFilterChange = (f: StatusFilter) => {
    updateParams({ status: f, p: '1' });
  };

  const handleSaved = () => {
    setSelectedId(null);
    router.refresh();
  };

  return (
    <div>
      <h1 className="text-[24px] font-bold text-rp-navy mb-6">Membership Applications</h1>

      {/* Filter Dropdown */}
      <div className="flex items-center gap-3 mb-4">
        <label htmlFor="app-filter" className="text-xs font-medium text-rp-gray-500">
          Status:
        </label>
        <select
          id="app-filter"
          value={statusFilter}
          onChange={(e) => handleFilterChange(e.target.value as StatusFilter)}
          className="px-3 py-1.5 text-sm border border-rp-gray-300 rounded-lg text-rp-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors"
        >
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((f) => (
            <option key={f} value={f}>
              {filterLabels[f]} ({counts[f]})
            </option>
          ))}
        </select>
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-2xl border border-rp-gray-200 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rp-gray-100 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="#94A3B8" strokeWidth="1.5" />
              <path d="M9 9h6M9 13h4" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-rp-gray-500 text-sm mb-1">
            No {statusFilter === 'all' ? '' : statusFilter} applications
          </p>
          <p className="text-rp-gray-400 text-xs">
            {statusFilter === 'all'
              ? 'Applications will appear here when submitted.'
              : `No applications with status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-rp-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rp-gray-200">
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Name</th>
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Email</th>
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Company</th>
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-[12px] font-semibold text-rp-gray-500 uppercase tracking-wider px-5 py-3">Applied</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => setSelectedId(app.id)}
                  className={`border-b border-rp-gray-100 last:border-b-0 cursor-pointer transition-colors ${
                    selectedId === app.id ? 'bg-rp-gold/5' : 'hover:bg-rp-gray-50'
                  }`}
                >
                  <td className="px-5 py-3.5 text-sm font-medium text-rp-navy">{app.full_name}</td>
                  <td className="px-5 py-3.5 text-sm text-rp-gray-600">{app.email}</td>
                  <td className="px-5 py-3.5 text-sm text-rp-gray-600">{app.company_name ?? '\u2014'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[app.status]}`}>
                      {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-rp-gray-600">{formatDate(app.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}

      {/* Detail Modal */}
      {selectedId && (
        <ApplicationDetailModal
          applicationId={selectedId}
          onClose={() => setSelectedId(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
