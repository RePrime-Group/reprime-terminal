'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActivityTracker } from '@/lib/hooks/useActivityTracker';
import { REPRIME_STANDARD_FEES, type FeeDefaults } from '@/lib/utils/fee-resolver';
import { createClient } from '@/lib/supabase/client';
import { friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';
import NDAModal from '@/components/portal/NDAModal';
import PhoneConfirmModal from '@/components/portal/PhoneConfirmModal';
import StructureCommitModal, { type CommitStructure } from '@/components/portal/StructureCommitModal';
import DataRoomTab from '@/components/portal/DataRoomTab';
import RentRollTab from '@/components/portal/RentRollTab';
import CapExTab from '@/components/portal/CapExTab';
import ExitStrategyTab from '@/components/portal/ExitStrategyTab';
import InsightsTab from '@/components/portal/InsightsTab';
import { parseHoldPeriod } from '@/lib/utils/capex';
import { parseDealInputs, calculateDeal, calculatePropertyMetrics, calculateTraditionalClose, type DealInputs } from '@/lib/utils/deal-calculator';
import { useDealAssistantPanelOptional } from '@/components/portal/ai/DealAssistantContext';
import type {
  TerminalDDFolder,
  TerminalDDDocument,
  TerminalAvailabilitySlot,
} from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Sub-components — each lives in ./DealDetailClient/
// ---------------------------------------------------------------------------
import { type DealDetailClientProps, type TabKey } from './DealDetailClient/types';
import { MarketplaceBanner } from './DealDetailClient/MarketplaceBanner';
import { FinancialModelingTab } from './DealDetailClient/FinancialModelingTab';
import { TopNavBar } from './DealDetailClient/TopNavBar';
import { DealHeaderBar } from './DealDetailClient/DealHeaderBar';
import { AISpotlightBanner } from './DealDetailClient/AISpotlightBanner';
import { CancelledDealBanner } from './DealDetailClient/CancelledDealBanner';
import { HeroSection } from './DealDetailClient/HeroSection';
import { DepositInfoCard } from './DealDetailClient/DepositInfoCard';
import { TabBar } from './DealDetailClient/TabBar';
import { OverviewTab } from './DealDetailClient/OverviewTab';
import { PhotosTab } from './DealDetailClient/PhotosTab';
import { DealStructureTab } from './DealDetailClient/DealStructureTab';
import { ScheduleContactTab } from './DealDetailClient/ScheduleContactTab';
import { CommitmentSection } from './DealDetailClient/CommitmentSection';
import { ConfidentialityFooter } from './DealDetailClient/ConfidentialityFooter';
import { ExpressInterestModal } from './DealDetailClient/ExpressInterestModal';
import { PhotoLightbox } from './DealDetailClient/PhotoLightbox';
import { DocumentViewerModal } from './DealDetailClient/DocumentViewerModal';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DealDetailClient({
  deal,
  photoUrls,
  contactName,
  contactTitle,
  contactEmail,
  availabilitySlots,
  bookedTimes,
  locale,
  pipelineProgress,
  stageProgress,
  currentStage,
  hasSignedNDA: initialNDA = false,
  investorName = 'Member',
  investorEmail = '',
  addresses = [],
  pipelineTasks = [],
  tenants = [],
  capexItems = [],
  exitScenarios = [],
  insights = [],
  prevDeal = null,
  nextDeal = null,
  userNote = null,
  previewMode = false,
  globalFeeDefaults = REPRIME_STANDARD_FEES,
  resolvedDealFees,
  resolvedInvestorTerms,
  marketplaceInterestCount = 0,
  myMarketplaceInterest = null,
}: DealDetailClientProps) {
  const isMarketplaceDeal = deal.status === 'marketplace';
  const effectiveDealFees: FeeDefaults = resolvedDealFees ?? globalFeeDefaults;
  const effectiveInvestorTerms: FeeDefaults = resolvedInvestorTerms ?? globalFeeDefaults;
  const formatFeePct = (v: number): string =>
    Number.isInteger(v) ? `${v}%` : `${v.toFixed(2).replace(/\.?0+$/, '')}%`;
  const previewTitle = previewMode ? 'Preview mode — read-only' : undefined;
  const t = useTranslations('portal.dealDetail');
  const tc = useTranslations('portal.dealCard');
  const tcd = useTranslations('portal.countdown');
  const tcom = useTranslations('common');
  const ts = useTranslations('portal.structure');
  const tPt = useTranslations('portal.propertyTypes');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trackActivity: rawTrackActivity } = useActivityTracker();
  const trackActivity: typeof rawTrackActivity = previewMode
    ? (async () => {}) as typeof rawTrackActivity
    : rawTrackActivity;
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleShareDeal = async () => {
    try {
      const shareUrl = `${window.location.origin}/${locale}/deal/${deal.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (insecure context, permissions). Silently ignore.
    }
  };

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState<string>('');
  const [ndaSigned, setNdaSigned] = useState(initialNDA || previewMode);
  const [showNDAModal, setShowNDAModal] = useState(false);

  // Portfolio OM dropdown (Transaction Documents)
  const [omMenuOpen, setOmMenuOpen] = useState(false);
  const omMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!omMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (omMenuRef.current && !omMenuRef.current.contains(e.target as Node)) {
        setOmMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [omMenuOpen]);

  // Honor ?tab=... query param on mount (e.g. from in-app notifications).
  useEffect(() => {
    const qTab = searchParams?.get('tab');
    if (!qTab) return;
    const valid: TabKey[] = ['overview', 'due-diligence', 'photos', 'rent-roll', 'financial-modeling', 'deal-structure', 'capex', 'exit-strategy', 'insights', 'schedule'];
    if (!valid.includes(qTab as TabKey)) return;
    const rec = deal as unknown as Record<string, unknown>;
    if (qTab === 'rent-roll' && rec.show_rent_roll === false) return;
    if (qTab === 'capex' && rec.show_capex !== true) return;
    if (qTab === 'exit-strategy' && rec.show_exit_strategy !== true) return;
    if ((qTab === 'due-diligence' || qTab === 'photos') && !ndaSigned) {
      setShowNDAModal(true);
      return;
    }
    setActiveTab(qTab as TabKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy-loaded tab data
  const [lazyDDFolders, setLazyDDFolders] = useState<(TerminalDDFolder & { documents: TerminalDDDocument[] })[] | null>(null);
  const [ddLoading, setDDLoading] = useState(false);
  const [lazyContact, setLazyContact] = useState<{ name: string; title: string; email: string } | null>(null);
  const [lazySlots, setLazySlots] = useState<TerminalAvailabilitySlot[] | null>(null);
  const [lazyBookedTimes, setLazyBookedTimes] = useState<string[] | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Microsoft Office Online handles these directly (xlsm/xlsb render read-only,
  // macros stripped). Google Docs Viewer is used as a fallback for TIFF and
  // other formats browsers won't render natively.
  const OFFICE_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.xlsb', '.docx', '.doc', '.docm', '.pptx', '.ppt', '.pptm'];
  const GVIEW_EXTENSIONS = ['.tif', '.tiff', '.heic', '.heif'];
  const handleViewDocument = async (url: string, name: string, storagePath?: string) => {
    const lower = name.toLowerCase();
    const isOfficeFile = OFFICE_EXTENSIONS.some(ext => lower.endsWith(ext));
    const isGViewFile = GVIEW_EXTENSIONS.some(ext => lower.endsWith(ext));
    if ((isOfficeFile || isGViewFile) && storagePath) {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from('terminal-dd-documents')
        .createSignedUrl(storagePath, 300);
      if (data?.signedUrl) {
        const encoded = encodeURIComponent(data.signedUrl);
        setViewerUrl(
          isOfficeFile
            ? `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`
            : `https://docs.google.com/gview?url=${encoded}&embedded=true`,
        );
      } else {
        setViewerUrl(url);
      }
    } else {
      setViewerUrl(url);
    }
    setViewerName(name);
  };
  const [selectedStructure, setSelectedStructure] = useState<'assignment' | 'gplp'>('assignment');
  const [structureModal, setStructureModal] = useState<CommitStructure | null>(null);
  const [structurePhoneOpen, setStructurePhoneOpen] = useState(false);
  const [structureCommitting, setStructureCommitting] = useState(false);
  const [structurePhoneError, setStructurePhoneError] = useState<string | null>(null);
  const [structureExistingPhone, setStructureExistingPhone] = useState('');
  const [expressedInterest, setExpressedInterest] = useState(false);
  const [showExpressModal, setShowExpressModal] = useState(false);
  const [expressingInterest, setExpressingInterest] = useState(false);
  const [checkingInterest, setCheckingInterest] = useState(true);
  const [thesisExpanded, setThesisExpanded] = useState(false);
  const [thesisOverflows, setThesisOverflows] = useState(false);
  const thesisRef = useRef<HTMLParagraphElement | null>(null);

  // Detect whether the thesis paragraph is actually being clamped so we only show the toggle when useful.
  useEffect(() => {
    const el = thesisRef.current;
    if (!el) return;
    const measure = () => {
      if (thesisExpanded) return;
      setThesisOverflows(el.scrollHeight - el.clientHeight > 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [deal.acquisition_thesis, thesisExpanded]);

  // Track deal_viewed on mount
  useEffect(() => {
    trackActivity('deal_viewed', deal.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  // Check if user already expressed interest
  useEffect(() => {
    async function checkExisting() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCheckingInterest(false); return; }

      const { data } = await supabase
        .from('terminal_activity_log')
        .select('id')
        .eq('deal_id', deal.id)
        .eq('user_id', user.id)
        .eq('action', 'expressed_interest')
        .limit(1);

      if (data && data.length > 0) setExpressedInterest(true);
      setCheckingInterest(false);
    }
    checkExisting();
  }, [deal.id]);

  // Track tab-specific events
  useEffect(() => {
    if (activeTab === 'due-diligence') {
      trackActivity('dataroom_viewed', deal.id);
    } else if (activeTab === 'deal-structure') {
      trackActivity('structure_viewed', deal.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, deal.id]);

  // Lazy-fetch DD folders + documents when due-diligence or photos tab is first opened
  useEffect(() => {
    if ((activeTab !== 'due-diligence' && activeTab !== 'photos') || lazyDDFolders !== null || ddLoading) return;
    setDDLoading(true);
    (async () => {
      const supabase = createClient();
      const { data: folders } = await supabase
        .from('terminal_dd_folders')
        .select('id, deal_id, name, icon, display_order, address_id, parent_id')
        .eq('deal_id', deal.id)
        .order('display_order', { ascending: true });

      if (!folders || folders.length === 0) {
        setLazyDDFolders([]);
        setDDLoading(false);
        return;
      }

      // Batch-fetch all documents for all folders in one query
      const folderIds = folders.map((f) => f.id);
      const { data: allDocs } = await supabase
        .from('terminal_dd_documents')
        .select('id, folder_id, deal_id, name, display_name, file_size, file_type, storage_path, is_downloadable, doc_status, uploaded_by, sort_order, created_at')
        .in('folder_id', folderIds)
        .filter('storage_path', 'not.is', 'null')
        .order('sort_order', { ascending: true });

      const docsByFolder = new Map<string, TerminalDDDocument[]>();
      for (const doc of (allDocs ?? []) as TerminalDDDocument[]) {
        if (!docsByFolder.has(doc.folder_id)) docsByFolder.set(doc.folder_id, []);
        docsByFolder.get(doc.folder_id)!.push(doc);
      }

      setLazyDDFolders(
        (folders as TerminalDDFolder[]).map((f) => ({
          ...f,
          documents: docsByFolder.get(f.id) ?? [],
        }))
      );
      setDDLoading(false);
    })();
  }, [activeTab, deal.id, lazyDDFolders, ddLoading]);

  // Photos = image documents inside the dataroom. Derived from the same lazy
  // DD load so opening the Photos tab does not double-fetch.
  const PHOTO_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif|svg)$/i;
  const photoDocs = useMemo<TerminalDDDocument[]>(() => {
    if (!lazyDDFolders) return [];
    const out: TerminalDDDocument[] = [];
    for (const f of lazyDDFolders) {
      for (const d of f.documents) {
        const isImage =
          (d.file_type ?? '').toLowerCase().startsWith('image/') ||
          PHOTO_EXT_RE.test(d.name ?? '');
        if (isImage) out.push(d);
      }
    }
    return out;
  }, [lazyDDFolders]);

  // Photos tab pagination + lightbox. Loading every photo at once was making
  // the browser stutter on deals with 100+ images; we now render PHOTOS_PER_PAGE
  // tiles per page. The lightbox lets investors page through the full set
  // (across page boundaries) without leaving the modal.
  const PHOTOS_PER_PAGE = 16;
  const [photoPage, setPhotoPage] = useState(0);
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState<number | null>(null);
  const [photoLightboxLoading, setPhotoLightboxLoading] = useState(false);

  const totalPhotoPages = Math.max(1, Math.ceil(photoDocs.length / PHOTOS_PER_PAGE));
  const safePhotoPage = Math.min(photoPage, totalPhotoPages - 1);
  const visiblePhotos = useMemo(
    () => photoDocs.slice(safePhotoPage * PHOTOS_PER_PAGE, (safePhotoPage + 1) * PHOTOS_PER_PAGE),
    [photoDocs, safePhotoPage],
  );

  // Reset to page 0 when the photo list itself changes (e.g. tab opened on a
  // different deal). Keeping a stale page on a smaller list would render empty.
  useEffect(() => {
    setPhotoPage(0);
  }, [photoDocs.length]);

  // Keyboard nav for the lightbox: ESC to close, ←/→ to step.
  useEffect(() => {
    if (photoLightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPhotoLightboxIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setPhotoLightboxLoading(true);
        setPhotoLightboxIndex((i) =>
          i === null ? null : (i - 1 + photoDocs.length) % photoDocs.length,
        );
      } else if (e.key === 'ArrowRight') {
        setPhotoLightboxLoading(true);
        setPhotoLightboxIndex((i) =>
          i === null ? null : (i + 1) % photoDocs.length,
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoLightboxIndex, photoDocs.length]);

  // Lazy-fetch schedule & contact data when schedule tab is first opened
  useEffect(() => {
    if (activeTab !== 'schedule' || lazyContact !== null || scheduleLoading) return;
    setScheduleLoading(true);
    (async () => {
      const supabase = createClient();
      const [
        { data: settingsData },
        { data: slotsData },
        { data: bookedData },
      ] = await Promise.all([
        supabase
          .from('terminal_settings')
          .select('key, value')
          .in('key', ['contact_name', 'contact_title', 'contact_email']),
        supabase
          .from('terminal_availability_slots')
          .select('id, day_of_week, start_time, end_time, timezone, is_active, created_at')
          .eq('is_active', true)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('terminal_meetings')
          .select('scheduled_at')
          .eq('deal_id', deal.id)
          .in('status', ['scheduled']),
      ]);

      const sm: Record<string, string> = {};
      for (const s of settingsData ?? []) sm[s.key] = String(s.value ?? '');

      setLazyContact({
        name: sm.contact_name ?? '',
        title: sm.contact_title ?? '',
        email: sm.contact_email ?? '',
      });
      setLazySlots((slotsData ?? []) as TerminalAvailabilitySlot[]);
      setLazyBookedTimes((bookedData ?? []).map((m: { scheduled_at: string }) => m.scheduled_at));
      setScheduleLoading(false);
    })();
  }, [activeTab, deal.id, lazyContact, scheduleLoading]);

  const handleDocumentDownload = (docId: string) => {
    trackActivity('document_downloaded', deal.id, { document_id: docId });
  };

  const handleIRRSliderChange = () => {
    trackActivity('irr_calculator_used', deal.id);
  };

  const handleMeetingRequested = () => {
    trackActivity('meeting_requested', deal.id);
  };

  const handleExpressInterest = async () => {
    if (previewMode) return;
    setExpressingInterest(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('terminal_activity_log').insert({
        user_id: user.id,
        deal_id: deal.id,
        action: 'expressed_interest',
        metadata: {},
      });

      setExpressedInterest(true);
      setShowExpressModal(false);
    } finally {
      setExpressingInterest(false);
    }
  };

  // Load phone from profile so the structure-commit phone modal can pre-fill.
  useEffect(() => {
    if (previewMode) return;
    fetch('/api/user/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile?.phone) setStructureExistingPhone(data.profile.phone as string);
      })
      .catch(() => {});
  }, [previewMode]);

  const handleStructurePhoneConfirm = async (e164: string) => {
    if (!structureModal) return;
    setStructureCommitting(true);
    setStructurePhoneError(null);
    try {
      const terms_snapshot =
        structureModal === 'assignment'
          ? { assignmentFee: effectiveDealFees.assignmentFee }
          : {
              acqFee: effectiveDealFees.acqFee,
              assetMgmtFee: effectiveDealFees.assetMgmtFee,
              gpCarry: effectiveDealFees.gpCarry,
              prefReturn: effectiveDealFees.prefReturn,
            };
      const res = await fetch(`/api/deals/${deal.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'primary',
          phone: e164,
          investment_structure: structureModal,
          terms_snapshot,
        }),
      });
      if (res.ok) {
        setStructureExistingPhone(e164);
        setStructurePhoneOpen(false);
        setStructureModal(null);
        return;
      }
      setStructurePhoneError(
        await readApiError(
          res,
          "We couldn't save your commitment. Please try again, or contact RePrime if this keeps happening.",
        ),
      );
    } catch (err) {
      console.error('structure commit failed:', err);
      setStructurePhoneError(
        friendlyFetchError(err, "We couldn't save your commitment. Please try again."),
      );
    } finally {
      setStructureCommitting(false);
    }
  };

  // Headline metrics — property-level (fees forced to 0) so admin-entered fees
  // never move cap rate / CoC / IRR / DSCR / equity. Fee impact is surfaced
  // only in the Fee Disclosure section and the Returns Calculator below.
  const dealInputs = useMemo(() => parseDealInputs(deal as unknown as Record<string, unknown>), [deal]);
  const computed = useMemo(() => calculatePropertyMetrics(dealInputs), [dealInputs]);
  // Fee-adjusted inputs overlay the resolved REPRIME terms onto the raw deal
  // inputs. Used by the Returns Calculator and Option A/B cards to show
  // fee-impacted IRRs. The headline metrics above still go through
  // calculatePropertyMetrics (fees forced to 0) — that contract is unchanged.
  const feeAdjustedInputs = useMemo<DealInputs>(
    () => ({
      ...dealInputs,
      assignmentFee: effectiveDealFees.assignmentFee,
      acqFee: effectiveDealFees.acqFee,
      assetMgmtFee: effectiveDealFees.assetMgmtFee,
      gpCarry: effectiveDealFees.gpCarry,
      prefReturn: effectiveDealFees.prefReturn,
    }),
    [dealInputs, effectiveDealFees],
  );
  const feeAdjustedMetrics = useMemo(() => calculateDeal(feeAdjustedInputs), [feeAdjustedInputs]);
  const traditionalMetrics = useMemo(() => dealInputs.sellerFinancing ? calculateTraditionalClose(dealInputs) : null, [dealInputs]);
  const financialProps = useMemo(() => ({
    inputs: dealInputs,
    metrics: computed,
    traditional: traditionalMetrics,
    isEstimated: !(deal as unknown as Record<string, unknown>).debt_terms_quoted,
    feeDisclosure: effectiveDealFees,
  }), [dealInputs, computed, traditionalMetrics, deal, effectiveDealFees]);

  // DD progress calculation
  const ddProgress = (typeof pipelineProgress === 'number' && pipelineProgress >= 0) ? pipelineProgress : 0;

  // Contact initials
  const initials = contactName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Notification preferences (localStorage)

  const dealRecord = deal as unknown as Record<string, unknown>;
  const showRentRoll = dealRecord.show_rent_roll !== false; // default TRUE
  const showCapex = dealRecord.show_capex === true; // default FALSE
  const showExitStrategy = dealRecord.show_exit_strategy === true; // default FALSE
  const showInsights = insights.length > 0; // hidden until at least one insight exists

  const tabs: { key: TabKey; label: string; enabled: boolean }[] = [
    { key: 'overview', label: t('overview'), enabled: true },
    { key: 'due-diligence', label: t('dueDiligence'), enabled: true },
    { key: 'photos', label: t('photos'), enabled: true },
    { key: 'rent-roll', label: 'Rent Roll', enabled: showRentRoll },
    { key: 'financial-modeling', label: t('financialModeling'), enabled: true },
    { key: 'deal-structure', label: t('dealStructure'), enabled: true },
    { key: 'capex', label: 'CapEx & Condition', enabled: showCapex },
    { key: 'exit-strategy', label: 'Exit Strategy', enabled: showExitStrategy },
    { key: 'insights', label: 'Insights', enabled: showInsights },
    { key: 'schedule', label: t('scheduleContact'), enabled: true },
  ];

  // Social proof visibility
  const showSocialProof = (deal.viewing_count ?? 0) > 0 || (deal.meetings_count ?? 0) > 0;

  return (
    <div
      className="min-h-dvh rp-page-texture font-[family-name:var(--font-poppins)]"
      data-deal-id={deal.id}
      data-deal-name={deal.name}
    >
      <div className="h-[3px] bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />

      <TopNavBar
        deal={deal}
        locale={locale}
        previewMode={previewMode}
        isMarketplaceDeal={isMarketplaceDeal}
        expressedInterest={expressedInterest}
        checkingInterest={checkingInterest}
        linkCopied={linkCopied}
        handleShareDeal={handleShareDeal}
        onExpressInterestClick={() => setShowExpressModal(true)}
        userNote={userNote}
      />

      {isMarketplaceDeal && <MarketplaceBanner interestCount={marketplaceInterestCount} />}

      <div>
        <DealHeaderBar
          deal={deal}
          prevDeal={prevDeal}
          nextDeal={nextDeal}
          locale={locale}
          previewMode={previewMode}
          activeTab={activeTab}
        />

        {!previewMode && (
          <AISpotlightBanner dealId={deal.id} dealName={deal.name} />
        )}

        {deal.status === 'cancelled' && <CancelledDealBanner deal={deal} />}

        <HeroSection
          deal={deal}
          photoUrls={photoUrls}
          computed={computed}
          addresses={addresses}
          omMenuRef={omMenuRef}
          omMenuOpen={omMenuOpen}
          setOmMenuOpen={setOmMenuOpen}
          thesisRef={thesisRef}
          thesisExpanded={thesisExpanded}
          thesisOverflows={thesisOverflows}
          setThesisExpanded={setThesisExpanded}
          handleViewDocument={handleViewDocument}
        />

        <DepositInfoCard deal={deal} />

        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          ndaSigned={ndaSigned}
          dealId={deal.id}
          dealName={deal.name}
          tabBarRef={tabBarRef}
          setShowNDAModal={setShowNDAModal}
          setActiveTab={setActiveTab}
        />

        {/* ===== Overview Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
          <OverviewTab
            deal={deal}
            computed={computed}
            financialProps={financialProps}
            addresses={addresses}
            tenants={tenants}
            isMarketplaceDeal={isMarketplaceDeal}
            myMarketplaceInterest={myMarketplaceInterest}
            previewMode={previewMode}
            stageProgress={stageProgress}
            currentStage={currentStage}
            pipelineProgress={pipelineProgress}
            showSocialProof={showSocialProof}
          />
        </div>

        {/* ===== Due Diligence Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'due-diligence' ? 'block' : 'none' }}>
          <div className="mt-3 px-4 md:px-8">
            {ddLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <DataRoomTab
                folders={lazyDDFolders ?? deal.dd_folders}
                tasks={pipelineTasks}
                dealId={deal.id}
                dealName={deal.name}
                investorName={investorName}
                investorEmail={investorEmail}
                ddDeadline={deal.dd_deadline}
                closeDeadline={deal.close_deadline}
                extensionDeadline={deal.extension_deadline}
                onViewDocument={handleViewDocument}
                onDocumentDownload={handleDocumentDownload}
              />
            )}
          </div>
        </div>

        {/* ===== Photos Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'photos' ? 'block' : 'none' }}>
          <PhotosTab
            ddLoading={ddLoading}
            photoDocs={photoDocs}
            visiblePhotos={visiblePhotos}
            safePhotoPage={safePhotoPage}
            totalPhotoPages={totalPhotoPages}
            setPhotoPage={setPhotoPage}
            setPhotoLightboxIndex={setPhotoLightboxIndex}
            setPhotoLightboxLoading={setPhotoLightboxLoading}
            handleDocumentDownload={handleDocumentDownload}
          />
        </div>

        {/* ===== Rent Roll Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'rent-roll' ? 'block' : 'none' }}>
          <div className="mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10">
            <RentRollTab
              tenants={tenants}
              dealTotalSf={(() => {
                const sfNum = parseFloat((deal.square_footage ?? '').replace(/,/g, ''));
                return Number.isFinite(sfNum) && sfNum > 0 ? sfNum : null;
              })()}
              isPortfolio={!!deal.is_portfolio}
              buildings={addresses.map((a) => ({
                id: a.id,
                label: a.label,
                squareFootage: (() => {
                  const n = parseFloat((a.square_footage ?? '').replace(/,/g, ''));
                  return Number.isFinite(n) && n > 0 ? n : null;
                })(),
              }))}
            />
          </div>
        </div>

        {/* ===== CapEx Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'capex' ? 'block' : 'none' }}>
          <div className="mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10">
            <CapExTab
              items={capexItems}
              holdPeriodYears={parseHoldPeriod(deal.hold_period_years, 5)}
              isPortfolio={!!deal.is_portfolio}
              buildings={addresses.map((a) => ({ id: a.id, label: a.label }))}
            />
          </div>
        </div>

        {/* ===== Exit Strategy Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'exit-strategy' ? 'block' : 'none' }}>
          <div className="mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10">
            <ExitStrategyTab
              scenarios={exitScenarios}
              context={{
                distributableCF: computed.distributableCashFlow,
                loanAmount: computed.loanAmount,
                seniorRatePct: dealInputs.interestRate,
                amortYears: dealInputs.amortYears,
                hasMezz: dealInputs.sellerFinancing && computed.mezzAmount > 0,
                mezzAmount: computed.mezzAmount,
                mezzTermMonths: dealInputs.mezzTermMonths,
                equityInvested: computed.netEquity,
              }}
            />
          </div>
        </div>

        {/* ===== Insights Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'insights' ? 'block' : 'none' }}>
          <div className="mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10">
            <InsightsTab insights={insights} />
          </div>
        </div>

        {/* ===== Financial Modeling Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'financial-modeling' ? 'block' : 'none' }}>
          <div className="mt-4 md:mt-5 px-4 md:px-8 pb-6 md:pb-8">
            <FinancialModelingTab deal={deal} />
          </div>
        </div>

        {/* ===== Deal Structure Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'deal-structure' ? 'block' : 'none' }}>
          <DealStructureTab
            deal={deal}
            financialProps={financialProps}
            computed={computed}
            feeAdjustedMetrics={feeAdjustedMetrics}
            feeAdjustedInputs={feeAdjustedInputs}
            effectiveDealFees={effectiveDealFees}
            effectiveInvestorTerms={effectiveInvestorTerms}
            selectedStructure={selectedStructure}
            setSelectedStructure={setSelectedStructure}
            setStructureModal={setStructureModal}
            setStructurePhoneError={setStructurePhoneError}
            onSliderChange={handleIRRSliderChange}
          />
        </div>

        {/* ===== Schedule Tab ===== */}
        <div className="transition-opacity duration-200" style={{ display: activeTab === 'schedule' ? 'block' : 'none' }}>
          <ScheduleContactTab
            deal={deal}
            locale={locale}
            lazyContact={lazyContact}
            lazySlots={lazySlots}
            lazyBookedTimes={lazyBookedTimes}
            availabilitySlots={availabilitySlots}
            bookedTimes={bookedTimes}
            contactName={contactName}
            contactTitle={contactTitle}
            contactEmail={contactEmail}
            scheduleLoading={scheduleLoading}
            previewMode={previewMode}
            handleMeetingRequested={handleMeetingRequested}
          />
        </div>

        <CommitmentSection
          deal={deal}
          previewMode={previewMode}
          contactName={contactName}
          contactTitle={contactTitle}
          locale={locale}
          setActiveTab={setActiveTab}
          tabBarRef={tabBarRef}
        />

        <ConfidentialityFooter />
      </div>

      {showExpressModal && (
        <ExpressInterestModal
          deal={deal}
          previewMode={previewMode}
          expressingInterest={expressingInterest}
          onClose={() => setShowExpressModal(false)}
          onConfirm={handleExpressInterest}
        />
      )}

      {showNDAModal && (
        <NDAModal
          dealName={deal.name}
          onClose={() => setShowNDAModal(false)}
          onSign={async (type, signerInfo) => {
            if (previewMode) {
              setShowNDAModal(false);
              return;
            }
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('terminal_nda_signatures').insert({
              user_id: user?.id,
              deal_id: type === 'deal' ? deal.id : null,
              nda_type: type,
              signer_name: signerInfo.fullName,
              signer_company: signerInfo.company || null,
              signer_title: signerInfo.title || null,
            });
            setNdaSigned(true);
            setShowNDAModal(false);
            setActiveTab('due-diligence');
          }}
        />
      )}

      {photoLightboxIndex !== null && (
        <PhotoLightbox
          photoDocs={photoDocs}
          photoLightboxIndex={photoLightboxIndex}
          photoLightboxLoading={photoLightboxLoading}
          setPhotoLightboxIndex={setPhotoLightboxIndex}
          setPhotoLightboxLoading={setPhotoLightboxLoading}
        />
      )}

      {viewerUrl && (
        <DocumentViewerModal
          viewerUrl={viewerUrl}
          viewerName={viewerName}
          investorName={investorName}
          investorEmail={investorEmail}
          onClose={() => setViewerUrl(null)}
        />
      )}

      <StructureCommitModal
        open={structureModal !== null && !structurePhoneOpen}
        structure={structureModal ?? 'assignment'}
        fees={effectiveDealFees}
        purchasePrice={feeAdjustedInputs.purchasePrice}
        equityRequired={computed.netEquity}
        projectedIRR={
          structureModal === 'assignment'
            ? feeAdjustedMetrics.assignmentIRR
            : feeAdjustedMetrics.irr
        }
        projectedCoC={feeAdjustedMetrics.cocReturn}
        acqFeeDollar={feeAdjustedMetrics.acqFeeDollar}
        assetMgmtFeeDollarPerYear={feeAdjustedMetrics.assetMgmtFeeDollar}
        fullyFinanced={computed.netEquity <= 0}
        hasPositiveCashFlow={computed.distributableCashFlow > 0}
        previewMode={previewMode}
        onCancel={() => setStructureModal(null)}
        onCommit={() => {
          if (previewMode) return;
          setStructurePhoneError(null);
          setStructurePhoneOpen(true);
        }}
      />
      <PhoneConfirmModal
        open={structurePhoneOpen}
        initialE164={structureExistingPhone}
        submitting={structureCommitting}
        error={structurePhoneError}
        onCancel={() => {
          if (structureCommitting) return;
          setStructurePhoneOpen(false);
          setStructurePhoneError(null);
        }}
        onConfirm={handleStructurePhoneConfirm}
      />
    </div>
  );
}
