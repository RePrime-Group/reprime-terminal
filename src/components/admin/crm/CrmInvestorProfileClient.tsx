'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type {
  CrmLifecycleState,
  TerminalCrmInvestor,
  TerminalCrmMandate,
  TerminalCrmMessage,
} from '@/lib/types/database';
import { formatPrice } from '@/lib/utils/format';
import { LIFECYCLE_MAP } from './CrmConstants';
import { CrmAvatar } from './CrmAvatar';
import CrmStatusPill from './CrmStatusPill';
import CrmTimeline from './CrmTimeline';
import CrmMandatesTab from './CrmMandatesTab';
import CrmDocumentsTab from './CrmDocumentsTab';
import { sendCriteriaForm } from '@/app/[locale]/(admin)/admin/crm/actions';

type Tab = 'timeline' | 'mandates' | 'documents';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function timeAgo(value: string | null): string {
  if (!value) return '';
  const d = new Date(value).getTime();
  const diffMs = Date.now() - d;
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return 'just now';
}

export interface LinkedAuthUser {
  id: string;
  full_name: string;
  email: string;
}

interface ProfileProps {
  investor: TerminalCrmInvestor;
  mandates: TerminalCrmMandate[];
  messages: TerminalCrmMessage[];
  linkedUser: LinkedAuthUser | null;
  locale: string;
}

export default function CrmInvestorProfileClient({
  investor,
  mandates,
  messages,
  linkedUser,
  locale,
}: ProfileProps) {
  const t = useTranslations('admin.crm');
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('timeline');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fullName = `${investor.first_name} ${investor.last_name}`;

  // Mirror terminal_crm_investor_summary.lifecycle_state (the profile reads
  // the raw row, not the view, so derive it here).
  const lifecycleState: CrmLifecycleState = investor.auth_user_id
    ? 'active'
    : investor.criteria_submitted_at
      ? 'submitted'
      : investor.submission_token
        ? 'invited'
        : 'lead';
  const lifecycle = LIFECYCLE_MAP[lifecycleState];
  const preferredMethod = investor.preferred_contact_method;
  const contactItems: { method: string | null; label: string; value: string }[] = [
    { method: 'email', label: 'Email', value: investor.email ?? '' },
    { method: 'phone', label: 'Phone', value: investor.phone ?? '' },
    { method: 'whatsapp', label: 'WhatsApp', value: investor.whatsapp ?? '' },
    { method: 'linkedin', label: 'LinkedIn', value: investor.linkedin_url ?? '' },
  ].filter((c) => c.value);

  const capital = [
    { label: t('capEquityReady'), value: investor.equity_ready ? formatPrice(investor.equity_ready) : '—' },
    { label: t('capEquityCommitted'), value: investor.equity_committed ? formatPrice(investor.equity_committed) : '—' },
    { label: t('capDeployed'), value: formatPrice(investor.total_deployed_with_reprime ?? 0) },
    { label: t('capDeals'), value: String(investor.deal_count ?? 0) },
    {
      label: t('capLastContacted'),
      value: investor.last_contacted_at
        ? `${formatDateTime(investor.last_contacted_at)}${investor.last_contacted_by ? ` · ${investor.last_contacted_by}` : ''}`
        : t('lastContactedNever'),
    },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'timeline', label: t('tabTimeline') },
    { key: 'mandates', label: t('tabMandates') },
    { key: 'documents', label: t('tabDocuments') },
  ];

  // ── Send Criteria Form button state ────────────────────────────────────────
  const hasOutstandingToken = !!investor.submission_token;
  const hasSubmitted = !!investor.criteria_submitted_at;
  let sendButtonLabel: string;
  let sendButtonHint: string | null = null;
  if (hasOutstandingToken) {
    sendButtonLabel = t('resendCriteriaForm');
    sendButtonHint = investor.form_last_sent_at ? `${t('sentLabel')} ${timeAgo(investor.form_last_sent_at)}` : null;
  } else if (hasSubmitted) {
    sendButtonLabel = t('sendNewCriteriaForm');
    sendButtonHint = `${t('lastSubmitted')} ${timeAgo(investor.criteria_submitted_at)}`;
  } else {
    sendButtonLabel = t('sendCriteriaForm');
  }

  const handleSend = async () => {
    if (!investor.email) {
      setSendError(t('sendNoEmail'));
      return;
    }
    if (hasOutstandingToken && !confirm(t('resendConfirm'))) return;
    setSending(true);
    setSendError(null);
    const result = await sendCriteriaForm(investor.id);
    setSending(false);
    if (!result.ok) {
      setSendError(result.error);
      return;
    }
    router.refresh();
  };


  return (
    <div className="flex flex-col gap-6">
      {/* Top nav */}
      <div className="flex items-center justify-between gap-3">
        <Link href={`/${locale}/admin/crm`} className="text-sm text-rp-gray-500 hover:text-rp-navy">
          ← {t('backToList')}
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <button
              onClick={handleSend}
              disabled={sending || !investor.email}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {sending ? t('sending') : sendButtonLabel}
            </button>
            {sendButtonHint && (
              <span className="text-[11px] text-rp-gray-400 mt-1">{sendButtonHint}</span>
            )}
            {sendError && <span className="text-[11px] text-rp-red mt-1">{sendError}</span>}
          </div>
          <Link
            href={`/${locale}/admin/crm/${investor.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rp-gray-200 text-sm font-medium text-rp-navy hover:border-rp-gold/40"
          >
            {t('editProfile')}
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rp-gray-200 text-sm font-medium text-rp-gray-500 hover:text-rp-red hover:border-rp-red/40"
          >
            {t('delete')}
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteInvestorModal
          investorId={investor.id}
          investorName={fullName}
          onClose={() => setShowDeleteModal(false)}
          onDone={() => router.push(`/${locale}/admin/crm`)}
        />
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-5">
        <div className="flex items-start gap-4">
          <CrmAvatar
            firstName={investor.first_name}
            lastName={investor.last_name}
            photoUrl={investor.photo_url}
            size={72}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-rp-navy">{fullName}</h1>
              <CrmStatusPill status={investor.status} />
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${lifecycle.pill}`}
                title={
                  lifecycleState === 'active'
                    ? t('lifecycleActiveTitle')
                    : `Lifecycle: ${lifecycle.label}`
                }
              >
                {lifecycle.icon} {lifecycle.label}
              </span>
              {investor.is_accredited ? (
                <span className="text-xs font-medium text-rp-green">✓ {t('accredited')}</span>
              ) : (
                <span className="text-xs text-rp-gray-400">{t('notAccredited')}</span>
              )}
            </div>
            {(investor.title || investor.company_name) && (
              <p className="text-sm text-rp-gray-500 mt-0.5">
                {[investor.title, investor.company_name].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* Contact info */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-sm">
              {contactItems.map((c) => (
                <span
                  key={c.label}
                  className={`flex items-center gap-1.5 ${
                    c.method === preferredMethod ? 'text-rp-gold font-semibold' : 'text-rp-gray-600'
                  }`}
                >
                  {c.method === preferredMethod && <span title={t('preferredContact')}>★</span>}
                  <span className="text-rp-gray-400 text-xs">{c.label}:</span>
                  {c.value}
                </span>
              ))}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-rp-gray-500">
              {investor.source && (
                <span>
                  {t('fieldSource')}: <span className="text-rp-gray-700">{investor.source}</span>
                </span>
              )}
              {investor.referred_by && (
                <span>
                  {t('fieldReferredBy')}: <span className="text-rp-gray-700">{investor.referred_by}</span>
                </span>
              )}
              {investor.entity_type && (
                <span>
                  {t('fieldEntityType')}: <span className="text-rp-gray-700">{investor.entity_type}</span>
                </span>
              )}
            </div>

            {/* Linked Terminal user — only when auth_user_id is set AND the
                lookup found a matching row. */}
            {linkedUser && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rp-gold-bg border border-rp-gold/20">
                <span className="text-[11px] text-rp-gray-500">{t('linkedTo')}</span>
                <Link
                  href={`/${locale}/admin/investors?focus=${linkedUser.id}`}
                  className="text-[12px] font-semibold text-rp-navy hover:text-rp-gold flex items-center gap-1"
                  title={t('linkedToTitle')}
                >
                  {linkedUser.full_name || linkedUser.email}
                  {linkedUser.full_name && linkedUser.email && (
                    <span className="text-rp-gray-400 font-normal">({linkedUser.email})</span>
                  )}
                  <span className="text-rp-gold">↗</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Capital summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {capital.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-4">
            <div className="text-[10px] uppercase tracking-wide text-rp-gray-400">{c.label}</div>
            <div className="text-sm font-bold text-rp-navy mt-1 tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-rp-gray-200">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === tb.key
                ? 'border-rp-gold text-rp-navy'
                : 'border-transparent text-rp-gray-500 hover:text-rp-navy'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'timeline' && <CrmTimeline investorId={investor.id} messages={messages} />}
      {tab === 'mandates' && <CrmMandatesTab investorId={investor.id} mandates={mandates} />}
      {tab === 'documents' && (
        <CrmDocumentsTab investorId={investor.id} documents={investor.documents ?? []} />
      )}
    </div>
  );
}

/**
 * Password-confirmation modal for hard-deleting an investor.
 * Mirrors the DeleteUserModal pattern used by /admin/investors so the UX is
 * consistent across destructive admin actions.
 */
function DeleteInvestorModal({
  investorId,
  investorName,
  onClose,
  onDone,
}: {
  investorId: string;
  investorName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('admin.crm');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/crm/${investorId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) setError(t('incorrectPassword'));
        else if (res.status === 403) setError(t('deleteForbidden'));
        else setError(body?.error || t('deleteFailed'));
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setError(t('deleteFailed'));
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-rp-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={submit}>
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-bold text-rp-navy mb-2">{t('deleteTitle')}</h2>
            <p className="text-sm text-rp-gray-600 mb-4">
              {t('deleteBody', { name: investorName })}
            </p>
            <label className="block text-xs font-semibold text-rp-gray-600 mb-1.5">
              {t('yourPassword')}
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="w-full px-3 py-2 text-sm border border-rp-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold"
              disabled={busy}
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 bg-rp-gray-100/40 rounded-b-2xl border-t border-rp-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-rp-gray-700 hover:bg-rp-gray-100 rounded-lg disabled:opacity-50 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={busy || !password}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy ? t('deleting') : t('confirmDelete')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
