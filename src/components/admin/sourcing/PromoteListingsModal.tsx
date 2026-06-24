'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MatchedListing } from '@/lib/portal/types';
import type { PromotedDealStatus } from '@/lib/portal/listing-to-deal';
import {
  promoteListings,
  type PromoteOutcome,
} from '@/app/[locale]/(admin)/admin/sourcing/actions';
import type { SourcingTabOption } from './SourcingPageClient';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  listings: MatchedListing[];
  tabs: SourcingTabOption[];
  mandateId: string | null;
}

type Stage = 'form' | 'submitting' | 'results';

// Parent should conditionally mount this component — a fresh mount gives us
// fresh useState defaults, no reset effect needed.
export default function PromoteListingsModal({
  onClose,
  onSuccess,
  listings,
  tabs,
  mandateId,
}: Props) {
  const t = useTranslations('admin.sourcing.promote');

  const [stage, setStage] = useState<Stage>('form');
  const [status, setStatus] = useState<PromotedDealStatus>('draft');
  const [tabId, setTabId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<PromoteOutcome[]>([]);

  const submit = async () => {
    setStage('submitting');
    setError(null);
    const result = await promoteListings({
      listings,
      status,
      tabId,
      mandateId,
    });
    if (!result.ok) {
      setError(result.error);
      setStage('form');
      return;
    }
    setOutcomes(result.outcomes);
    setStage('results');
  };

  const createdCount = outcomes.filter((o) => o.status === 'created').length;
  const failedCount = outcomes.filter((o) => o.status === 'failed').length;
  const skippedCount = outcomes.filter((o) => o.status === 'skipped').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={() => stage === 'form' && onClose()}
    >
      <div
        className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-rp-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-rp-navy">
            {stage === 'results' ? t('resultsTitle') : t('title', { n: listings.length })}
          </h2>
          {stage === 'form' && (
            <button
              type="button"
              onClick={onClose}
              className="text-rp-gray-400 hover:text-rp-navy text-xl leading-none"
              aria-label={t('close')}
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {stage === 'form' && (
            <div className="flex flex-col gap-5">
              {/* Selected preview */}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-rp-gray-500 font-semibold mb-1.5">
                  {t('selectedListings')}
                </div>
                <ul className="text-sm text-rp-navy max-h-32 overflow-y-auto bg-rp-gray-100/40 rounded-md p-2.5 space-y-0.5">
                  {listings.map((l) => (
                    <li key={l.listing_id} className="truncate">• {l.listing_title}</li>
                  ))}
                </ul>
              </div>

              {/* Status choice */}
              <fieldset className="flex flex-col gap-2">
                <legend className="text-[11px] uppercase tracking-wide text-rp-gray-500 font-semibold mb-1">
                  {t('statusLabel')}
                </legend>
                <StatusOption
                  value="draft"
                  current={status}
                  onChange={setStatus}
                  title={t('statusDraftTitle')}
                  description={t('statusDraftDescription')}
                />
                <StatusOption
                  value="marketplace"
                  current={status}
                  onChange={setStatus}
                  title={t('statusMarketplaceTitle')}
                  description={t('statusMarketplaceDescription')}
                />
              </fieldset>

              {/* Group picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide text-rp-gray-500 font-semibold">
                  {t('groupLabel')}
                </label>
                <select
                  value={tabId ?? ''}
                  onChange={(e) => setTabId(e.target.value || null)}
                  className="px-3 py-2 rounded-lg border border-rp-gray-200 bg-white text-sm text-rp-navy focus:outline-none focus:border-rp-gold"
                >
                  <option value="">{t('groupNone')}</option>
                  {tabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-rp-gray-500">{t('groupHint')}</p>
              </div>

              {error && (
                <div className="text-sm bg-rp-red-light border border-rp-red/30 text-rp-red rounded-md px-3 py-2">
                  {error}
                </div>
              )}
            </div>
          )}

          {stage === 'submitting' && (
            <div className="py-10 text-center text-sm text-rp-gray-500">
              {t('submitting', { n: listings.length })}
            </div>
          )}

          {stage === 'results' && (
            <div className="flex flex-col gap-3">
              <div className="text-sm text-rp-gray-700">
                {t('resultsSummary', { created: createdCount, failed: failedCount, skipped: skippedCount })}
              </div>
              <ul className="divide-y divide-rp-gray-100 border border-rp-gray-200 rounded-md max-h-64 overflow-y-auto">
                {outcomes.map((o) => (
                  <li key={o.listing_id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <OutcomeBadge status={o.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-rp-navy truncate">
                          {o.listing_title}
                        </div>
                        {o.error && (
                          <div className="text-[12px] text-rp-red mt-0.5">{o.error}</div>
                        )}
                        {o.warnings && o.warnings.length > 0 && (
                          <div className="text-[12px] text-rp-amber mt-0.5">
                            {o.warnings.join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-rp-gray-100 flex items-center justify-end gap-2">
          {stage === 'form' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-md text-sm text-rp-gray-600 hover:bg-rp-gray-100"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={submit}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {status === 'draft' ? t('submitDraft') : t('submitMarketplace')}
              </button>
            </>
          )}
          {stage === 'results' && (
            <button
              type="button"
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-rp-navy text-white text-sm font-semibold hover:opacity-90"
            >
              {t('done')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusOption({
  value,
  current,
  onChange,
  title,
  description,
}: {
  value: PromotedDealStatus;
  current: PromotedDealStatus;
  onChange: (v: PromotedDealStatus) => void;
  title: string;
  description: string;
}) {
  const checked = current === value;
  return (
    <label
      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
        checked
          ? 'border-rp-gold bg-rp-gold-bg/40'
          : 'border-rp-gray-200 hover:border-rp-gray-300'
      }`}
    >
      <input
        type="radio"
        name="promote-status"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1 w-4 h-4 accent-rp-gold"
      />
      <div className="flex-1">
        <div className="text-sm font-semibold text-rp-navy">{title}</div>
        <div className="text-[12px] text-rp-gray-600 mt-0.5">{description}</div>
      </div>
    </label>
  );
}

function OutcomeBadge({ status }: { status: PromoteOutcome['status'] }) {
  const map = {
    created: { label: '✓', cls: 'bg-rp-green-light text-rp-green' },
    failed:  { label: '✕', cls: 'bg-rp-red-light text-rp-red' },
    skipped: { label: '—', cls: 'bg-rp-gray-200 text-rp-gray-500' },
  } as const;
  const s = map[status];
  return (
    <span className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}
