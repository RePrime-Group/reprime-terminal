'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TerminalCrmMandate } from '@/lib/types/database';
import type { MatchRequest, MatchedListing } from '@/lib/portal/types';
import { mandateToCriteria, type UnsupportedMandateField } from '@/lib/portal/mandate-to-criteria';
import { fetchMatches, type FetchMatchesResult } from '@/app/[locale]/(admin)/admin/sourcing/actions';
import MandatePicker from './MandatePicker';
import CustomCriteriaForm from './CustomCriteriaForm';
import MatchedListingsList from './MatchedListingsList';
import PromoteListingsModal from './PromoteListingsModal';

export interface SourcingInvestorOption {
  id: string;
  label: string;
  company: string | null;
}

export interface SourcingMandateOption {
  id: string;
  investorId: string;
  label: string;
  raw: TerminalCrmMandate;
}

export interface SourcingTabOption {
  id: string;
  name: string;
}

interface Props {
  locale: string;
  investors: SourcingInvestorOption[];
  mandates: SourcingMandateOption[];
  tabs: SourcingTabOption[];
  /** Used to build "Open in Portal" links (`<base>/listings/<id>`). Empty if unconfigured. */
  portalBaseUrl: string;
  preselectedMandateId: string | null;
}

type Mode = 'mandate' | 'custom';
const PAGE_SIZE = 25;

export default function SourcingPageClient({
  investors,
  mandates,
  tabs,
  portalBaseUrl,
  preselectedMandateId,
}: Props) {
  const t = useTranslations('admin.sourcing');

  // Mode: mandate or custom criteria. Default = mandate unless deep-link.
  const [mode, setMode] = useState<Mode>('mandate');

  // Mandate-driven state.
  const initialMandate = useMemo(
    () => mandates.find((m) => m.id === preselectedMandateId) ?? null,
    [mandates, preselectedMandateId],
  );
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(
    initialMandate?.investorId ?? null,
  );
  const [selectedMandateId, setSelectedMandateId] = useState<string | null>(
    initialMandate?.id ?? null,
  );

  // Custom criteria state.
  const [customCriteria, setCustomCriteria] = useState<MatchRequest>({});

  // Results state.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FetchMatchesResult | null>(null);
  const [offset, setOffset] = useState(0);
  const [selectedListingIds, setSelectedListingIds] = useState<Set<string>>(new Set());
  const [promoteOpen, setPromoteOpen] = useState(false);

  // Derived: which criteria are we about to send, and which fields would be
  // skipped (mandate mode only)?
  const mandateTranslation = useMemo(() => {
    if (mode !== 'mandate' || !selectedMandateId) return null;
    const mandate = mandates.find((m) => m.id === selectedMandateId);
    return mandate ? mandateToCriteria(mandate.raw) : null;
  }, [mode, selectedMandateId, mandates]);

  const criteriaToSend: MatchRequest | null = useMemo(() => {
    if (mode === 'mandate') return mandateTranslation?.criteria ?? null;
    return customCriteria;
  }, [mode, mandateTranslation, customCriteria]);

  const runSearch = useCallback(
    async (atOffset = 0) => {
      if (!criteriaToSend) {
        setError(t('errPickMandateFirst'));
        return;
      }
      setLoading(true);
      setError(null);
      setOffset(atOffset);
      setSelectedListingIds(new Set());
      const res = await fetchMatches({ ...criteriaToSend, limit: PAGE_SIZE, offset: atOffset });
      setResult(res);
      setLoading(false);
      if (!res.ok) setError(res.error);
    },
    [criteriaToSend, t],
  );

  // Auto-run when deep-linked with ?mandate=…
  useEffect(() => {
    if (initialMandate) runSearch(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages =
    result?.ok && result.total > 0 ? Math.ceil(result.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const listings: MatchedListing[] = result?.ok ? result.listings : [];
  const alreadyPromoted = result?.ok ? new Set(result.alreadyPromoted) : new Set<string>();
  const selectedListings = listings.filter((l) => selectedListingIds.has(l.listing_id));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-rp-navy">{t('title')}</h1>
          <p className="text-sm text-rp-gray-500 mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="inline-flex rounded-lg border border-rp-gray-200 bg-white p-1 self-start">
        <button
          type="button"
          onClick={() => setMode('mandate')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            mode === 'mandate'
              ? 'bg-rp-navy text-white'
              : 'text-rp-gray-500 hover:text-rp-navy'
          }`}
        >
          {t('modeMandate')}
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            mode === 'custom'
              ? 'bg-rp-navy text-white'
              : 'text-rp-gray-500 hover:text-rp-navy'
          }`}
        >
          {t('modeCustom')}
        </button>
      </div>

      {/* Criteria card */}
      <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-5">
        {mode === 'mandate' ? (
          <MandatePicker
            investors={investors}
            mandates={mandates}
            selectedInvestorId={selectedInvestorId}
            selectedMandateId={selectedMandateId}
            onInvestorChange={(id) => {
              setSelectedInvestorId(id);
              setSelectedMandateId(null);
            }}
            onMandateChange={setSelectedMandateId}
            translation={mandateTranslation}
          />
        ) : (
          <CustomCriteriaForm value={customCriteria} onChange={setCustomCriteria} />
        )}

        <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-rp-gray-100">
          <button
            type="button"
            onClick={() => runSearch(0)}
            disabled={loading || !criteriaToSend || (mode === 'mandate' && !selectedMandateId)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? t('loading') : t('searchListings')}
          </button>
        </div>
      </div>

      {/* Unsupported warning (mandate mode) */}
      {mode === 'mandate' && mandateTranslation && hasUnsupported(mandateTranslation) && (
        <UnsupportedWarning translation={mandateTranslation} />
      )}

      {/* Error */}
      {error && (
        <div className="bg-rp-red-light border border-rp-red/30 text-rp-red rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result?.ok && (
        <MatchedListingsList
          listings={listings}
          total={result.total}
          offset={offset}
          pageSize={PAGE_SIZE}
          currentPage={currentPage}
          totalPages={totalPages}
          alreadyPromoted={alreadyPromoted}
          selectedIds={selectedListingIds}
          onSelectionChange={setSelectedListingIds}
          onPromote={() => setPromoteOpen(true)}
          onPrev={() => runSearch(Math.max(0, offset - PAGE_SIZE))}
          onNext={() => runSearch(offset + PAGE_SIZE)}
          portalBaseUrl={portalBaseUrl}
        />
      )}

      {promoteOpen && (
        <PromoteListingsModal
          onClose={() => setPromoteOpen(false)}
          onSuccess={() => {
            setSelectedListingIds(new Set());
            runSearch(offset);
          }}
          listings={selectedListings}
          tabs={tabs}
          mandateId={mode === 'mandate' ? selectedMandateId : null}
        />
      )}
    </div>
  );
}

function hasUnsupported(t: {
  unsupported: UnsupportedMandateField[];
  droppedPropertyTypes: string[];
  droppedStates: string[];
}): boolean {
  return t.unsupported.length > 0 || t.droppedPropertyTypes.length > 0 || t.droppedStates.length > 0;
}

function UnsupportedWarning({
  translation,
}: {
  translation: {
    unsupported: UnsupportedMandateField[];
    droppedPropertyTypes: string[];
    droppedStates: string[];
  };
}) {
  const t = useTranslations('admin.sourcing');
  return (
    <div className="bg-rp-amber-light border border-rp-amber/30 rounded-lg px-4 py-3 text-sm text-rp-gray-700">
      <div className="font-semibold text-rp-amber mb-1">{t('unsupportedTitle')}</div>
      <ul className="list-disc pl-5 space-y-0.5">
        {translation.unsupported.map((f) => (
          <li key={f}>{t(`unsupported.${f}` as `unsupported.${UnsupportedMandateField}`)}</li>
        ))}
        {translation.droppedPropertyTypes.length > 0 && (
          <li>
            {t('droppedPropertyTypes')}: {translation.droppedPropertyTypes.join(', ')}
          </li>
        )}
        {translation.droppedStates.length > 0 && (
          <li>
            {t('droppedStates')}: {translation.droppedStates.join(', ')}
          </li>
        )}
      </ul>
    </div>
  );
}
