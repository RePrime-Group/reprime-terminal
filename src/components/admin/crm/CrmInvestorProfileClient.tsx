'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { TerminalCrmInvestor, TerminalCrmMessage } from '@/lib/types/database';
import { formatPrice } from '@/lib/utils/format';
import { CrmAvatar } from './CrmAvatar';
import CrmStatusPill from './CrmStatusPill';
import CrmTimeline from './CrmTimeline';
import CrmPreferencesTab from './CrmPreferencesTab';
import CrmDocumentsTab from './CrmDocumentsTab';

type Tab = 'timeline' | 'preferences' | 'documents';

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

export default function CrmInvestorProfileClient({
  investor,
  messages,
  locale,
}: {
  investor: TerminalCrmInvestor;
  messages: TerminalCrmMessage[];
  locale: string;
}) {
  const t = useTranslations('admin.crm');
  const [tab, setTab] = useState<Tab>('timeline');

  const fullName = `${investor.first_name} ${investor.last_name}`;
  const preferredMethod = investor.preferred_contact_method;
  const contactItems: { method: string | null; label: string; value: string }[] = [
    { method: 'email', label: 'Email', value: investor.email ?? '' },
    { method: 'phone', label: 'Phone', value: investor.phone ?? '' },
    { method: 'whatsapp', label: 'WhatsApp', value: investor.whatsapp ?? '' },
    { method: 'linkedin', label: 'LinkedIn', value: investor.linkedin_url ?? '' },
  ].filter((c) => c.value);

  const capital = [
    { label: t('capEquityReady'), value: investor.equity_ready ? formatPrice(investor.equity_ready) : '—' },
    {
      label: t('capEquityCommitted'),
      value: investor.equity_committed ? formatPrice(investor.equity_committed) : '—',
    },
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
    { key: 'preferences', label: t('tabPreferences') },
    { key: 'documents', label: t('tabDocuments') },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top nav */}
      <div className="flex items-center justify-between gap-3">
        <Link href={`/${locale}/admin/crm`} className="text-sm text-rp-gray-500 hover:text-rp-navy">
          ← {t('backToList')}
        </Link>
        <Link
          href={`/${locale}/admin/crm/${investor.id}/edit`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rp-gray-200 text-sm font-medium text-rp-navy hover:border-rp-gold/40"
        >
          {t('editProfile')}
        </Link>
      </div>

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
      {tab === 'preferences' && <CrmPreferencesTab prefs={investor.investment_preferences} />}
      {tab === 'documents' && (
        <CrmDocumentsTab investorId={investor.id} documents={investor.documents ?? []} />
      )}
    </div>
  );
}
