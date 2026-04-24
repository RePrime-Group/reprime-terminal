'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatPrice, formatPriceCompact, formatPercent, formatDSCR, formatSqFt, formatNumber } from '@/lib/utils/format';
import { useCountdown } from '@/lib/hooks/useCountdown';
import { useActivityTracker } from '@/lib/hooks/useActivityTracker';
import { calculateCustomIRR } from '@/lib/utils/irr-calculator';
import { createClient } from '@/lib/supabase/client';
import { friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';
import FadeInOnScroll from '@/components/ui/FadeInOnScroll';
import NDAModal from '@/components/portal/NDAModal';
import PhoneConfirmModal from '@/components/portal/PhoneConfirmModal';
import DataRoomTab from '@/components/portal/DataRoomTab';
import RentRollTab from '@/components/portal/RentRollTab';
import CapExTab from '@/components/portal/CapExTab';
import ExitStrategyTab from '@/components/portal/ExitStrategyTab';
import { parseHoldPeriod } from '@/lib/utils/capex';
import { OverviewFinancials, DealStructureFinancials } from '@/components/portal/FinancialOverview';
import { parseDealInputs, calculateDeal, calculatePropertyMetrics, calculateTraditionalClose, type DealInputs, type DealMetrics } from '@/lib/utils/deal-calculator';
import { exportDealToExcel } from '@/lib/utils/excel-export';
import type {
  DealWithDetails,
  TerminalDDFolder,
  TerminalDDDocument,
  TerminalAvailabilitySlot,
  TerminalTenantLease,
  CapExItem,
  ExitScenario,
} from '@/lib/types/database';
import { computeWALT, computeOccupancy, formatYears } from '@/lib/utils/rent-roll';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DealDetailClientProps {
  deal: DealWithDetails;
  photoUrls: string[];
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  availabilitySlots: TerminalAvailabilitySlot[];
  bookedTimes: string[];
  locale: string;
  pipelineProgress?: number;
  stageProgress?: Record<string, { total: number; completed: number }>;
  currentStage?: string;
  hasSignedNDA?: boolean;
  investorName?: string;
  investorEmail?: string;
  addresses?: { id: string; label: string; address: string | null; city: string | null; state: string | null; square_footage: string | null; units: string | null; om_storage_path: string | null }[];
  pipelineTasks?: { id: string; name: string; status: string; stage: string }[];
  tenants?: TerminalTenantLease[];
  capexItems?: CapExItem[];
  exitScenarios?: ExitScenario[];
  prevDeal?: { id: string; name: string } | null;
  nextDeal?: { id: string; name: string } | null;
  /**
   * When true the view renders exactly as an investor sees it, but every write
   * action is short-circuited. Used by the /admin/preview routes so admins can
   * audit the investor experience without creating rows under their own id.
   */
  previewMode?: boolean;
}

type TabKey =
  | 'overview'
  | 'due-diligence'
  | 'rent-roll'
  | 'financial-modeling'
  | 'deal-structure'
  | 'capex'
  | 'exit-strategy'
  | 'schedule';
type CalculatorMode = 'assignment' | 'gplp' | 'custom';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/* ---------- Prev/Next Deal Arrow ---------- */

function DealNavArrow({
  direction,
  target,
  locale,
  previewMode,
  activeTab,
  label,
  compact = false,
}: {
  direction: 'prev' | 'next';
  target: { id: string; name: string } | null;
  locale: string;
  previewMode: boolean;
  activeTab: string;
  label: string;
  compact?: boolean;
}) {
  const basePath = previewMode
    ? `/${locale}/admin/deals`
    : `/${locale}/portal/deals`;
  const tabQuery = activeTab && activeTab !== 'overview' ? `?tab=${activeTab}` : '';
  const href = target
    ? (previewMode
        ? `${basePath}/${target.id}/preview${tabQuery}`
        : `${basePath}/${target.id}${tabQuery}`)
    : null;

  const titleText = target ? `${label}: ${target.name}` : label;
  const isPrev = direction === 'prev';
  // Full-viewBox chevron so the icon fills the button nicely.
  const iconPath = isPrev ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
  const sizeClass = compact ? 'w-9 h-9' : 'w-11 h-11 md:w-12 md:h-12';
  const iconSize = compact ? 18 : 22;
  const sharedClass = `flex items-center justify-center ${sizeClass} rounded-full border-2 transition-all shrink-0`;

  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        title={titleText}
        className={`${sharedClass} border-[#EEF0F4] bg-white opacity-40 cursor-not-allowed shadow-[0_4px_14px_rgba(14,52,112,0.08)]`}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={iconPath} />
        </svg>
      </span>
    );
  }

  return (
    <a
      href={href}
      aria-label={titleText}
      title={titleText}
      className={`${sharedClass} border-[#BC9C45]/40 bg-white text-[#0E3470] shadow-[0_4px_14px_rgba(14,52,112,0.12)] hover:border-[#BC9C45] hover:bg-[#BC9C45] hover:text-white hover:shadow-[0_6px_20px_rgba(188,156,69,0.35)] hover:-translate-y-0.5`}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
    </a>
  );
}

/* ---------- Circular Countdown Ring ---------- */

function CountdownRing({
  label,
  targetDate,
  accentColor,
}: {
  label: string;
  targetDate: string | null;
  accentColor: string;
}) {
  const { days, hours, minutes, seconds, isExpired, isUrgent } =
    useCountdown(targetDate);
  const t = useTranslations('portal.dealDetail');

  const size = 150;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate progress (assume 90-day max for visual fill)
  const maxDays = 90;
  const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  const maxSeconds = maxDays * 86400;
  const progress = isExpired ? 0 : Math.min(totalSeconds / maxSeconds, 1);
  const dashOffset = circumference * (1 - progress);

  const ringColor = isUrgent && !isExpired ? '#DC2626' : isExpired ? '#D1D5DB' : accentColor;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#EEF0F4"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[52px] font-[800] leading-none tracking-tight tabular-nums"
            style={{ color: ringColor }}
          >
            {isExpired ? '00' : days}
          </span>
          <span className="text-[10px] font-[700] uppercase tracking-[2px] text-[#6B7280] mt-1">
            {t('daysUpper')}
          </span>
          <span className="text-[12px] text-[#9CA3AF] mt-1 font-mono tabular-nums">
            {hh}:{mm}:{ss}
          </span>
        </div>
      </div>
      {/* Label below ring */}
      <div className="flex items-center gap-1.5 mt-3">
        {isUrgent && !isExpired && (
          <div className="w-2 h-2 rounded-full bg-[#DC2626] countdown-pulse" />
        )}
        {isExpired && (
          <div className="w-2 h-2 rounded-full bg-[#D1D5DB]" />
        )}
        <span className="text-[12px] uppercase font-[700] tracking-[2px] text-[#0E3470]">
          {label}
        </span>
      </div>
      {isUrgent && !isExpired && (
        <span className="bg-[#DC2626] text-white text-[9px] px-2 py-0.5 rounded-full font-semibold mt-1.5">
          {t('urgent')}
        </span>
      )}
    </div>
  );
}

/* ---------- Image Carousel ---------- */

function ImageCarousel({ urls }: { urls: string[] }) {
  const [current, setCurrent] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxLoading, setLightboxLoading] = useState(true);
  // Touch-swipe tracking. swipedRef suppresses the img's onClick
  // (which opens the lightbox) when the tap was actually a swipe.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);

  if (urls.length === 0) {
    return (
      <div className="w-full h-[45vh] md:h-[65vh] rounded-2xl overflow-hidden relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0E3470 40%, #1D5FB8 100%)' }}>
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: 'linear-gradient(rgba(188,156,69,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(188,156,69,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
          <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 text-[#BC9C45]/20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 21V7l9-4 9 4v14H3zm2-2h5v-4h4v4h5V8.3l-7-3.1L5 8.3V19zm2-6h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-8-4h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z"/>
          </svg>
        </div>
      </div>
    );
  }

  const goNext = () => { setImageLoading(true); setLightboxLoading(true); setCurrent((p) => (p + 1) % urls.length); };
  const goPrev = () => { setImageLoading(true); setLightboxLoading(true); setCurrent((p) => (p - 1 + urls.length) % urls.length); };
  const goTo = (idx: number) => { if (idx !== current) { setImageLoading(true); setLightboxLoading(true); setCurrent(idx); } };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) swipedRef.current = true;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (urls.length <= 1) return;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  return (
    <>
      <div
        className="relative w-full h-[45vh] md:h-[65vh] rounded-2xl overflow-hidden group"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={urls[current]}
          alt={`Property photo ${current + 1}`}
          className={`w-full h-full object-cover cursor-pointer transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
          onClick={() => {
            if (swipedRef.current) { swipedRef.current = false; return; }
            setLightboxLoading(true);
            setLightboxOpen(true);
          }}
          onLoad={() => { setImageLoading(false); setDisplayIndex(current); }}
        />
        {/* Skeleton overlay while loading */}
        {imageLoading && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#BC9C45] rounded-full animate-spin" />
          </div>
        )}
        {urls.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-[44px] h-[44px] bg-white/90 hover:bg-white shadow-lg text-[#0E3470] rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous photo"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 12L6 8l4-4" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-[44px] h-[44px] bg-white/90 hover:bg-white shadow-lg text-[#0E3470] rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next photo"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {urls.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                    idx === displayIndex ? 'bg-[#BC9C45]' : 'bg-white/50'
                  }`}
                  aria-label={`Go to photo ${idx + 1}`}
                />
              ))}
            </div>
            {/* Slide counter badge */}
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
              {displayIndex + 1}/{urls.length}
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            aria-label="Close lightbox"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>

          {/* Counter */}
          {urls.length > 1 && (
            <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold px-4 py-1.5 rounded-full">
              {current + 1} / {urls.length}
            </div>
          )}

          {/* Previous arrow */}
          {urls.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              aria-label="Previous photo"
            >
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 12L6 8l4-4" />
              </svg>
            </button>
          )}

          {/* Image with loading state */}
          <div className="relative max-h-[85vh] max-w-[90vw] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {lightboxLoading && (
              <div className="absolute inset-0 rounded-lg overflow-hidden flex items-center justify-center" style={{ minWidth: '300px', minHeight: '200px' }}>
                <div className="w-8 h-8 border-2 border-white/20 border-t-[#BC9C45] rounded-full animate-spin" />
              </div>
            )}
            <img
              src={urls[current]}
              alt={`Property photo ${current + 1}`}
              className={`max-h-[85vh] max-w-[90vw] object-contain rounded-lg transition-opacity duration-300 ${lightboxLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setLightboxLoading(false)}
            />
          </div>

          {/* Next arrow */}
          {urls.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              aria-label="Next photo"
            >
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- Metric Card ---------- */

/**
 * Build the IRR assumptions note shown below the IRR value on metric cards.
 * Uses the deal's stored exit cap / hold / rent growth, with a "(entry +1%)"
 * qualifier when exit cap falls back to the default.
 */
function buildIrrAssumptions(
  deal: { exit_cap_rate?: string | null; hold_period_years?: string | null; rent_growth?: string | null },
  metrics: Pick<DealMetrics, 'capRate'>
): string {
  const storedExit = deal.exit_cap_rate ? parseFloat(String(deal.exit_cap_rate)) : 0;
  const exitCapStr = storedExit > 0
    ? `${storedExit.toFixed(1)}% exit`
    : `${(metrics.capRate + 1).toFixed(1)}% exit (entry +1%)`;
  const hold = deal.hold_period_years ? parseInt(String(deal.hold_period_years), 10) : 5;
  const holdStr = `${hold}yr hold`;
  const growth = deal.rent_growth ? parseFloat(String(deal.rent_growth)) : 0;
  const growthStr = growth > 0 ? ` · ${growth.toFixed(1)}% growth` : '';
  return `${exitCapStr} · ${holdStr}${growthStr}`;
}

function MetricCard({
  label,
  value,
  borderColor,
  valueColor,
  note,
  size = 'normal',
}: {
  label: string;
  value: string | null;
  borderColor: string;
  valueColor?: string;
  note?: string;
  size?: 'headline' | 'normal';
}) {
  const valueSize =
    size === 'headline'
      ? 'text-[26px] md:text-[34px]'
      : 'text-[20px] md:text-[27px]';
  return (
    <div
      className="group relative h-full bg-white rounded-xl p-3 md:p-3.5 border border-[#EEF0F4] rp-card-shadow hover:shadow-[0_6px_24px_rgba(14,52,112,0.08)] hover:-translate-y-[1px] transition-all duration-200"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="data-label mb-1.5">
        {label}
      </div>
      <div
        className={`${valueSize} font-bold tabular-nums leading-none tracking-tight`}
        style={{ color: valueColor ?? '#0E3470' }}
      >
        {value ?? '—'}
      </div>
      {note && (
        <div className="text-[10px] text-[#9CA3AF] mt-1.5 leading-tight">
          {note}
        </div>
      )}
    </div>
  );
}

/* ---------- File Type Badge ---------- */

function FileTypeBadge({ fileType }: { fileType: string | null }) {
  const ext = fileType?.toLowerCase() ?? '';
  let icon = '\u{1F4C4}';
  let colorClass = 'bg-gray-100 text-gray-600';
  let label = 'FILE';

  if (ext.includes('pdf')) {
    icon = '\u{1F4D5}';
    colorClass = 'bg-red-100 text-red-600';
    label = 'PDF';
  } else if (ext.includes('sheet') || ext.includes('xlsx')) {
    icon = '\u{1F4D7}';
    colorClass = 'bg-green-100 text-green-600';
    label = 'XLSX';
  } else if (ext.includes('word') || ext.includes('docx')) {
    colorClass = 'bg-blue-100 text-blue-600';
    label = 'DOC';
  } else if (ext.includes('zip')) {
    icon = '\u{1F4E6}';
    colorClass = 'bg-blue-100 text-blue-600';
    label = 'ZIP';
  }

  return (
    <span className={`${colorClass} text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1`}>
      <span>{icon}</span> {label}
    </span>
  );
}

/* ---------- Commitment Card ---------- */

function CommitmentCard({ deal, previewMode = false }: { deal: DealWithDetails; previewMode?: boolean }) {
  const t = useTranslations('portal.dealDetail');
  const tcom = useTranslations('common');
  const isAssigned = deal.status === 'assigned';
  const [showWire, setShowWire] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [commitType, setCommitType] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [totalCommitments, setTotalCommitments] = useState(0);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [existingPhone, setExistingPhone] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Check for existing commitment on mount
  useEffect(() => {
    if (isAssigned) return;
    fetch(`/api/deals/${deal.id}/commit`)
      .then((r) => r.json())
      .then((data) => {
        if (data.commitment) {
          setCommitted(true);
          setCommitType(data.commitment.type);
        }
      })
      .catch(() => {});

    // Load phone from profile so the modal can pre-fill.
    fetch('/api/user/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile?.phone) setExistingPhone(data.profile.phone as string);
      })
      .catch(() => {});

    // Get total commitment count for this deal
    const supabase = createClient();
    supabase
      .from('terminal_deal_commitments')
      .select('*', { count: 'exact', head: true })
      .eq('deal_id', deal.id)
      .in('status', ['pending', 'wire_sent', 'confirmed'])
      .then(({ count }) => setTotalCommitments(count ?? 0));
  }, [deal.id, isAssigned]);

  const handleCommit = async (type: 'primary' | 'backup', phone?: string) => {
    if (previewMode) return false;
    setCommitting(true);
    setPhoneError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...(phone ? { phone } : {}) }),
      });
      if (res.ok) {
        if (phone) setExistingPhone(phone);
        setCommitted(true);
        setCommitType(type);
        setTotalCommitments((p) => p + 1);
        setShowPhoneModal(false);
        setShowWire(false);
        return true;
      }
      setPhoneError(await readApiError(res, 'We couldn\u2019t save your commitment. Please try again, or contact RePrime if this keeps happening.'));
      return false;
    } catch (err) {
      console.error('commit failed:', err);
      setPhoneError(friendlyFetchError(err, 'We couldn\u2019t save your commitment. Please try again.'));
      return false;
    } finally {
      setCommitting(false);
    }
  };

  const handleWithdraw = async (phone: string) => {
    if (previewMode) return;
    setWithdrawing(true);
    setPhoneError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setExistingPhone(phone);
        setCommitted(false);
        setCommitType(null);
        setShowWithdrawConfirm(false);
        setTotalCommitments((p) => Math.max(0, p - 1));
        return;
      }
      setPhoneError(await readApiError(res, 'We couldn\u2019t process the withdrawal right now. Please try again, or contact RePrime if this keeps happening.'));
    } catch (err) {
      console.error('withdraw failed:', err);
      setPhoneError(friendlyFetchError(err, 'We couldn\u2019t process the withdrawal right now. Please try again.'));
    } finally {
      setWithdrawing(false);
    }
  };

  if (isAssigned) {
    return (
      <div className="mb-6">
        <div className="relative overflow-hidden rounded-xl bg-[#FDF8ED] border border-[#BC9C45]/30 rp-card-shadow">
          <div className="px-5 py-6 md:px-8 md:py-8 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-start md:items-center gap-4 md:gap-5 min-w-0">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-[#BC9C45]/15 border-2 border-[#BC9C45] flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-[#BC9C45] uppercase tracking-[2px] mb-1">
                  {t('dealAssignedEyebrow')}
                </div>
                <h3 className="text-[18px] md:text-[22px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)] leading-tight">
                  {t('dealAssigned')}
                </h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  {t('dealAssignedDesc')}
                </p>
              </div>
            </div>
          </div>
          <div className="h-[2px] bg-gradient-to-r from-transparent via-[#BC9C45]/50 to-transparent" />
        </div>
      </div>
    );
  }

  if (committed) {
    return (
      <div className="mb-6">
        {/* Prominent committed banner */}
        <div className="relative overflow-hidden rounded-xl bg-white border border-[#EEF0F4] rp-card-shadow">
          <div className="px-5 py-6 md:px-8 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start md:items-center gap-4 md:gap-5 min-w-0">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-[#ECFDF5] border-2 border-[#0B8A4D] flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B8A4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-[#BC9C45] uppercase tracking-[2px] mb-1">
                  {t('dealCommitted')}
                </div>
                <h3 className="text-[18px] md:text-[22px] font-semibold text-[#0E3470] font-[family-name:var(--font-playfair)] leading-tight">
                  {commitType === 'backup' ? t('backupPositionRegistered') : t('youAreCommitted')}
                </h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  {t('contactWithin24')}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
              {totalCommitments > 1 && (
                <div className="text-left md:text-right">
                  <div className="text-[28px] font-bold text-[#BC9C45] leading-none">{totalCommitments}</div>
                  <div className="text-[10px] text-[#9CA3AF] uppercase tracking-[1.5px] mt-1">{t('groupsCommitted')}</div>
                </div>
              )}
              <button
                onClick={() => {
                  setPhoneError(null);
                  setShowWithdrawConfirm(true);
                }}
                disabled={previewMode}
                title={previewMode ? 'Preview mode — read-only' : undefined}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FCA5A5] text-[#DC2626] text-[11px] font-semibold hover:bg-[#FEF2F2] hover:border-[#DC2626] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9" />
                  <path d="M21 3v6h-6" />
                </svg>
                {t('withdraw')}
              </button>
            </div>
          </div>

          <div className="h-[2px] bg-gradient-to-r from-transparent via-[#BC9C45]/50 to-transparent" />
        </div>

        <PhoneConfirmModal
          open={showWithdrawConfirm}
          initialE164={existingPhone}
          submitting={withdrawing}
          error={phoneError}
          title={t('withdrawConfirmTitle')}
          description={t('withdrawConfirmDesc')}
          confirmLabel={t('confirmWithdrawal')}
          confirmingLabel={t('withdrawing')}
          confirmTone="danger"
          onCancel={() => {
            if (withdrawing) return;
            setShowWithdrawConfirm(false);
            setPhoneError(null);
          }}
          onConfirm={handleWithdraw}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-8 rp-card-shadow border border-[#EEF0F4] mb-6">
      {/* FOMO banner when others have committed */}
      {totalCommitments > 0 && (
        <div className="mb-5 p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-center gap-3">
          <div className="text-[20px]">🔥</div>
          <div>
            <span className="text-[13px] font-bold text-[#DC2626]">
              {t('groupsAlreadyCommitted', { count: totalCommitments })}
            </span>
            <p className="text-[11px] text-[#DC2626]/60 mt-0.5">{t('positionsLimited')}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 md:gap-0 mb-5">
        <div>
          <h3 className="font-[family-name:var(--font-playfair)] text-[22px] font-semibold text-[#0E3470]">
            {t('commitToThisDeal')}
          </h3>
          <p className="text-[13px] text-[#6B7280] mt-2">
            {deal.deposit_amount && <>{t('deposit')} {deal.deposit_amount}</>}
            {deal.deposit_amount && <> · Held by: Bruce J. Smoler, Esq., Escrow Attorney</>}
            {!deal.deposit_amount && t('contactToDiscuss')}
          </p>
        </div>
        <button
          onClick={() => setShowWire(true)}
          disabled={committing || previewMode}
          title={previewMode ? 'Preview mode — read-only' : undefined}
          className="w-full md:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[15px] font-bold shadow-[0_6px_24px_rgba(188,156,69,0.3)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('lockThisDeal')}
        </button>
      </div>

      {showWire && (
        <div className="p-6 bg-[#FDF8ED] rounded-xl border border-[#ECD9A0]/30 animate-slide-down mb-5">
          <div className="text-[14px] font-semibold text-[#0E3470] mb-3">
            {t('wire', { amount: deal.deposit_amount || 'deposit' })}
          </div>
          <div className="bg-white rounded-lg p-4 text-[13px] text-[#4B5563] leading-[1.7] border border-[#EEF0F4]">
            Wire funds to the designated escrow trust account held by Bruce J. Smoler, Esq. at Smoler & Associates, P.A. — J.P. Morgan Chase Florida IOTA Trust Account
            <br />
            Acct No.: 991521071
            <br />
            ABA No.: 267084131
            <br />
            Wire deadline: 72 hours from confirmation.
            <br />
            Full wiring instructions will be delivered upon confirmation.
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => {
                setPhoneError(null);
                setShowPhoneModal(true);
              }}
              disabled={committing || previewMode}
              title={previewMode ? 'Preview mode — read-only' : undefined}
              className="flex-1 py-3.5 rounded-xl bg-[#BC9C45] hover:bg-[#A88A3D] text-[#0E3470] text-[13px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {committing ? t('processing') : t('confirmSendWire')}
            </button>
            <button
              onClick={() => setShowWire(false)}
              className="px-6 py-3.5 rounded-xl border border-[#EEF0F4] text-[#6B7280] text-[12px] font-medium hover:bg-[#F7F8FA] transition-colors"
            >
              {tcom('cancel')}
            </button>
          </div>
        </div>
      )}

      <PhoneConfirmModal
        open={showPhoneModal}
        initialE164={existingPhone}
        submitting={committing}
        error={phoneError}
        onCancel={() => {
          if (committing) return;
          setShowPhoneModal(false);
          setPhoneError(null);
        }}
        onConfirm={(e164) => handleCommit('primary', e164)}
      />

      {/* Backup position */}
      <div className="p-4 bg-[#F7F8FA] rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <div className="text-[12px] font-semibold text-[#0E3470]">{t('backupPositionAvailable')}</div>
          <div className="text-[11px] text-[#6B7280] mt-1">
            {t('backupDescription')}
          </div>
        </div>
        <button
          onClick={() => handleCommit('backup')}
          disabled={committing || previewMode}
          title={previewMode ? 'Preview mode — read-only' : undefined}
          className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-lg border border-[#EEF0F4] bg-white text-[#0E3470] text-[11px] font-semibold hover:border-[#BC9C45] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('registerAsBackup')}
        </button>
      </div>
    </div>
  );
}

/* ---------- Financial Modeling Tab ---------- */

function FinancialModelingTab({ deal }: { deal: DealWithDetails }) {
  const t = useTranslations('portal.dealDetail');

  // Base inputs & metrics from the deal's stored data — computed once
  const baseInputs = useMemo(
    () => parseDealInputs(deal as unknown as Record<string, unknown>),
    [deal]
  );
  const baseMetrics = useMemo(() => calculatePropertyMetrics(baseInputs), [baseInputs]);

  // Slider state — initialized from deal's actual data
  const [exitCap, setExitCap] = useState(
    baseInputs.exitCapRate > 0
      ? String(baseInputs.exitCapRate)
      : String(+(baseMetrics.capRate + 1).toFixed(2))
  );
  const [holdYears, setHoldYears] = useState(String(baseInputs.holdPeriodYears || 5));
  const [rentGrowth, setRentGrowth] = useState('3');
  const [ltv, setLtv] = useState(String(baseInputs.ltv));
  const [rate, setRate] = useState(String(baseInputs.interestRate));

  // Live modeling metrics — recomputes on every slider change via the REAL engine
  const mm = useMemo(() => {
    const overriddenInputs: DealInputs = {
      ...baseInputs,
      ltv: parseFloat(ltv) || baseInputs.ltv,
      interestRate: parseFloat(rate) || baseInputs.interestRate,
      holdPeriodYears: parseInt(holdYears) || baseInputs.holdPeriodYears || 5,
      exitCapRate: parseFloat(exitCap) || 0,
      rentGrowth: parseFloat(rentGrowth) || 0,
    };
    return calculatePropertyMetrics(overriddenInputs);
  }, [baseInputs, ltv, rate, holdYears, exitCap, rentGrowth]);

  const holdNum = parseInt(holdYears) || 5;
  const exitCapNum = parseFloat(exitCap) || 0;
  const totalProfit = mm.annualCashFlows.reduce((a, b) => a + b, 0) + mm.netSaleProceeds - mm.netEquity;

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString();

  const sliders = [
    { label: t('exitCapRate'), val: exitCap, set: setExitCap, min: '4', max: '15', step: '0.25' },
    { label: t('holdPeriod'), val: holdYears, set: setHoldYears, min: '1', max: '15', step: '1' },
    { label: t('annualRentGrowth'), val: rentGrowth, set: setRentGrowth, min: '0', max: '10', step: '0.5' },
    { label: t('loanToValue'), val: ltv, set: setLtv, min: '0', max: '85', step: '5' },
    { label: t('interestRatePercent'), val: rate, set: setRate, min: '3', max: '10', step: '0.25' },
  ];

  const mmFullyFinanced = mm.netEquity <= 0;
  const mmHasPositiveCF = mm.distributableCashFlow > 0;
  const mmInfReturn = mmFullyFinanced ? (mmHasPositiveCF ? '∞' : 'N/A') : null;
  const greenOrDefault = mmFullyFinanced ? '#0B8A4D' : undefined;
  const results = [
    { l: t('exitValue'), v: fmt(mm.exitPrice), c: '#0E3470' },
    { l: t('totalProfit'), v: fmt(totalProfit), c: totalProfit > 0 ? '#0B8A4D' : '#DC2626' },
    { l: t('equityMultiple'), v: mmInfReturn ?? (mm.equityMultiple !== null ? mm.equityMultiple.toFixed(2) + 'x' : '—'), c: greenOrDefault ?? '#BC9C45' },
    { l: t('estLeveredIrr'), v: mmInfReturn ?? (mm.irr !== null ? mm.irr.toFixed(2) + '%' : 'N/A'), c: '#0B8A4D' },
    { l: t('annualDebtService'), v: fmt(mm.headlineSeniorDS + mm.annualMezzPayment), c: '#0E3470' },
    { l: t('equityRequired'), v: mmFullyFinanced ? '$0' : fmt(mm.netEquity), c: greenOrDefault ?? '#BC9C45' },
  ];

  // Exit NOI for cap rate sensitivity (grown NOI at hold period end)
  const exitNOI = baseInputs.noi * Math.pow(1 + (parseFloat(rentGrowth) || 0) / 100, holdNum);

  const handleExportExcel = () => {
    exportDealToExcel(deal, baseInputs, mm, {
      ltv: parseFloat(ltv) || baseInputs.ltv,
      rate: parseFloat(rate) || baseInputs.interestRate,
      holdYears: parseInt(holdYears) || baseInputs.holdPeriodYears || 5,
      exitCap: parseFloat(exitCap) || 0,
      rentGrowth: parseFloat(rentGrowth) || 0,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
      {/* Assumptions Panel */}
      <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
        <div className="flex items-center justify-between mb-5 gap-3">
          <h3 className="font-[family-name:var(--font-playfair)] text-[16px] font-semibold text-[#0E3470]">
            {t('assumptions')}
          </h3>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#FDF8ED] border border-[#BC9C45] text-[#BC9C45] hover:bg-[#BC9C45] hover:text-white text-[11px] font-semibold rounded-lg transition-colors"
            aria-label={t('exportToExcel')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('exportToExcel')}
          </button>
        </div>
        {sliders.map((inp, i) => {
          const pct = ((parseFloat(inp.val) - parseFloat(inp.min)) / (parseFloat(inp.max) - parseFloat(inp.min))) * 100;
          return (
            <div key={i} className="mb-5">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] font-medium text-[#4B5563]">{inp.label}</span>
                <span className="text-[13px] font-semibold text-[#0E3470] tabular-nums">
                  {inp.val}{inp.label.includes('years') ? '' : '%'}
                </span>
              </div>
              <input
                type="range"
                min={inp.min}
                max={inp.max}
                step={inp.step}
                value={inp.val}
                onChange={(e) => inp.set(e.target.value)}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(90deg, #BC9C45 ${pct}%, #EEF0F4 ${pct}%)`,
                }}
              />
            </div>
          );
        })}
        <div className="mt-4 p-3.5 bg-[#FDF8ED] rounded-lg border border-[#ECD9A0]/30">
          <div className="text-[9px] font-semibold text-[#BC9C45] uppercase tracking-[2px] mb-1">{t('basis')}</div>
          <div className="text-[11px] text-[#4B5563]">
            {t('purchase')} {fmt(mm.netBasis)} · {t('cap')} {mm.capRate.toFixed(2)}% · {t('noi')} {formatPrice(deal.noi)}
          </div>
        </div>
      </div>

      {/* Results Panel */}
      <div className="flex flex-col gap-4">
        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {results.map((m, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-4 border border-[#EEF0F4] rp-card-shadow"
              style={{ borderLeft: `3px solid ${m.c}` }}
            >
              <div className="text-[8px] font-bold text-[#9CA3AF] uppercase tracking-[2px]">{m.l}</div>
              <div className="text-[20px] font-bold tabular-nums mt-1.5" style={{ color: m.c }}>{m.v}</div>
            </div>
          ))}
        </div>

        {/* Cash flow chart */}
        <div className="bg-white rounded-xl p-4 md:p-6 border border-[#EEF0F4] rp-card-shadow overflow-hidden">
          <h4 className="text-[13px] font-semibold text-[#0E3470] mb-4">{t('projectedAnnualCashFlow')}</h4>
          {(() => {
            const chartH = 180;
            const cashFlows = mm.annualCashFlows;
            const maxCF = Math.max(...cashFlows, 0);
            const minCF = Math.min(...cashFlows);
            const range = maxCF - minCF || maxCF * 0.2 || 100_000;
            const steps = [5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000];
            const step = steps.find(s => Math.ceil(range / s) <= 5) ?? steps[steps.length - 1];
            const yFloor = Math.max(0, Math.floor(minCF / step) * step);
            const yCeil = Math.ceil(maxCF * 1.05 / step) * step;
            const ticks: number[] = [];
            for (let v = yFloor; v <= yCeil; v += step) ticks.push(v);
            const yRange = yCeil - yFloor || 1;
            const yLabel = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1_000).toLocaleString()}K`;

            return (
              <div>
                <div className="flex">
                  <div className="relative shrink-0 w-[44px]" style={{ height: chartH }}>
                    {ticks.map((tick) => {
                      const bottom = ((tick - yFloor) / yRange) * 100;
                      return (
                        <span
                          key={tick}
                          className="absolute right-1 text-[8px] text-[#9CA3AF] tabular-nums leading-none whitespace-nowrap"
                          style={{ bottom: `${bottom}%`, transform: 'translateY(50%)' }}
                        >
                          {yLabel(tick)}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex-1 relative" style={{ height: chartH }}>
                    {ticks.map((tick) => {
                      const bottom = ((tick - yFloor) / yRange) * 100;
                      return (
                        <div
                          key={tick}
                          className="absolute left-0 right-0 border-t border-[#EEF0F4]"
                          style={{ bottom: `${bottom}%` }}
                        />
                      );
                    })}
                    <div className="flex items-end gap-1.5 md:gap-3 relative z-10 h-full px-1 md:px-2">
                      {cashFlows.map((cf, i) => {
                        const barH = yRange > 0 ? Math.max(((cf - yFloor) / yRange) * chartH, 4) : 4;
                        return (
                          <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full">
                            <span className="text-[8px] md:text-[9px] font-bold tabular-nums mb-1 whitespace-nowrap" style={{ color: cf > 0 ? '#0B8A4D' : '#DC2626' }}>
                              {fmt(cf)}
                            </span>
                            <div
                              className="w-full rounded-t-lg transition-all duration-500"
                              style={{
                                height: barH,
                                background: cf > 0
                                  ? 'linear-gradient(180deg, #0B8A4D, rgba(11,138,77,0.3))'
                                  : 'linear-gradient(180deg, #DC2626, rgba(220,38,38,0.3))',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex" style={{ marginLeft: 44 }}>
                  <div className="flex-1 flex gap-1.5 md:gap-3 px-1 md:px-2">
                    {cashFlows.map((_, i) => (
                      <div key={i} className="flex-1 text-center">
                        <span className="text-[9px] text-[#9CA3AF] font-semibold">{t('yr')} {i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Cap rate sensitivity */}
        <div className="bg-white rounded-xl p-6 border border-[#EEF0F4] rp-card-shadow">
          <h4 className="text-[13px] font-semibold text-[#0E3470] mb-3">{t('capRateSensitivity')}</h4>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[6.0, 6.5, 7.0, 7.5, 8.0].map((cr) => {
              const ev = exitNOI / (cr / 100);
              const isSel = cr === exitCapNum;
              return (
                <button
                  key={cr}
                  onClick={() => setExitCap(String(cr))}
                  className="text-center py-2.5 px-1 rounded-lg transition-all cursor-pointer hover:ring-2 hover:ring-[#BC9C45]/30"
                  style={{ background: isSel ? '#0E3470' : '#F7F8FA' }}
                >
                  <div className="text-[10px] font-bold" style={{ color: isSel ? '#D4A843' : '#9CA3AF' }}>{cr}%</div>
                  <div className="text-[12px] font-bold mt-1 tabular-nums" style={{ color: isSel ? '#FFFFFF' : '#0E3470' }}>{fmt(ev)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Real Activity Feed ---------- */

function RealActivityFeed({ dealId }: { dealId: string }) {
  const t = useTranslations('portal.dealDetail');
  const tcom = useTranslations('common');
  const [activities, setActivities] = useState<{ action: string; created_at: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('terminal_activity_log')
      .select('action, created_at')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setActivities(data ?? []);
        setLoaded(true);
      });
  }, [dealId]);

  const actionLabels: Record<string, { text: string; dot: string }> = {
    deal_viewed: { text: t('dealViewedByMember'), dot: 'bg-[#6B7280]' },
    document_downloaded: { text: t('documentDownloaded'), dot: 'bg-[#1D5FB8]' },
    om_downloaded: { text: t('omDownloaded'), dot: 'bg-[#BC9C45]' },
    dataroom_viewed: { text: t('dataRoomAccessed'), dot: 'bg-[#0E3470]' },
    meeting_requested: { text: t('meetingRequested'), dot: 'bg-[#BC9C45]' },
    expressed_interest: { text: t('interestExpressedActivity'), dot: 'bg-[#0B8A4D]' },
    irr_calculator_used: { text: t('irrCalculatorUsed'), dot: 'bg-[#1D5FB8]' },
    structure_viewed: { text: t('dealStructureViewed'), dot: 'bg-[#6B7280]' },
    portal_viewed: { text: t('portalAccessed'), dot: 'bg-[#9CA3AF]' },
  };

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('justNow');
    if (mins < 60) return t('minAgo', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs > 1 ? t('hrsAgo', { count: hrs }) : t('hrAgo', { count: hrs });
    const days = Math.floor(hrs / 24);
    return days > 1 ? t('daysAgo', { count: days }) : t('dayAgo', { count: days });
  }

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
      <h4 className="text-sm font-semibold text-[#0E3470] mb-3">
        {t('recentActivity')}
      </h4>
      <div className="space-y-3">
        {!loaded ? (
          <div className="text-xs text-[#9CA3AF]">{tcom('loading')}</div>
        ) : activities.length === 0 ? (
          <div className="text-xs text-[#9CA3AF]">{t('noActivityYet')}</div>
        ) : (
          activities.map((item, idx) => {
            const info = actionLabels[item.action] ?? { text: item.action, dot: 'bg-[#9CA3AF]' };
            return (
              <div
                key={idx}
                className="flex items-start gap-2 animate-slide-in"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className={`w-2 h-2 rounded-full ${info.dot} mt-1.5 shrink-0`} />
                <div>
                  <div className="text-xs text-[#374151]">{info.text}</div>
                  <div className="text-xs text-[#6B7280]">{timeAgo(item.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ---------- DD Folder Card ---------- */

function DDFolderCard({
  folder,
  dealId,
  onDocumentDownload,
  onViewDocument,
}: {
  folder: TerminalDDFolder & { documents: TerminalDDDocument[] };
  dealId: string;
  onDocumentDownload: (docId: string) => void;
  onViewDocument: (url: string, name: string, storagePath?: string) => void;
}) {
  const t = useTranslations('portal.dealDetail');
  const [expanded, setExpanded] = useState(false);
  const docCount = folder.documents.length;

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] overflow-hidden cursor-pointer hover:border-[#BC9C45] transition-colors rp-card-shadow">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-[#F7F8FA] flex items-center justify-center text-lg">
          {folder.icon ?? '\uD83D\uDCC1'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-[#0E3470] truncate">
            {folder.name}
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            {t('documentsCount', { count: docCount })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-[#9CA3AF] transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[#EEF0F4]">
          {folder.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 py-3 px-4 border-b border-[#EEF0F4] last:border-0"
            >
              <FileTypeBadge fileType={doc.file_type} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#0E3470] font-medium truncate">
                  {doc.name}
                </div>
                <div className="text-[11px] text-[#9CA3AF]">
                  {doc.file_size ?? t('unknownSize')}
                </div>
              </div>
              {/* View button for PDFs, images, and Office files */}
              {(doc.file_type === 'application/pdf' || doc.name?.endsWith('.pdf') || doc.file_type?.startsWith('image/') || /\.(xlsx?|docx?|pptx?)$/i.test(doc.name)) && (
                <button
                  onClick={() => {
                    onDocumentDownload(doc.id);
                    onViewDocument(`/api/documents/${doc.id}/download?view=true`, doc.name, doc.storage_path ?? undefined);
                  }}
                  className="text-[#BC9C45] hover:text-[#A88A3D] transition-colors"
                  aria-label={`View ${doc.name}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}
              <a
                href={`/api/documents/${doc.id}/download`}
                onClick={() => onDocumentDownload(doc.id)}
                className="text-[#1D5FB8] hover:text-[#0E3470] transition-colors"
                aria-label={`Download ${doc.name}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </a>
            </div>
          ))}
          {folder.documents.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[#9CA3AF]">
              <span className="text-2xl block mb-2">{'\u231B'}</span>
              {t('documentsPendingUpload')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- IRR Calculator Panel ---------- */

function IRRCalculatorPanel({
  deal,
  baseIRR: baseIRRProp,
  assignmentIRRProp,
  acqFeeDollar,
  assetMgmtFeeDollar,
  onSliderChange,
  fullyFinanced = false,
  hasPositiveCashFlow = true,
}: {
  deal: DealWithDetails;
  baseIRR: number;
  assignmentIRRProp: number | null;
  acqFeeDollar: number;
  assetMgmtFeeDollar: number;
  onSliderChange: () => void;
  fullyFinanced?: boolean;
  hasPositiveCashFlow?: boolean;
}) {
  const t = useTranslations('portal.dealDetail');
  const ts = useTranslations('portal.structure');
  const [mode, setMode] = useState<CalculatorMode>('assignment');
  const [lpSplit, setLpSplit] = useState(80);
  const [prefReturn, setPrefReturn] = useState(8);
  const [acqFee, setAcqFee] = useState(1);

  const customIRR = useMemo(() => {
    return calculateCustomIRR(baseIRRProp, { lpSplit, prefReturn, acqFee });
  }, [baseIRRProp, lpSplit, prefReturn, acqFee]);

  const infReturn = fullyFinanced ? (hasPositiveCashFlow ? '∞' : 'N/A') : null;

  const handleSliderChange = (
    setter: (v: number) => void,
    value: number
  ) => {
    setter(value);
    onSliderChange();
  };

  const modes: { key: CalculatorMode; label: string }[] = [
    { key: 'assignment', label: ts('assignment') },
    { key: 'gplp', label: t('gpLp') },
    { key: 'custom', label: ts('customTerms') },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#EEF0F4] rp-card-shadow">
      <div className="data-label !text-[#BC9C45] !tracking-[2px] mb-4">
        {t('returnsCalc')}
      </div>

      {/* Mode tabs */}
      <div className="inline-flex rounded-lg bg-[#F7F8FA] p-1 mb-6">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === m.key
                ? 'bg-[#0E3470] text-white'
                : 'text-[#6B7280] hover:text-[#0E3470]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Assignment Mode */}
      {mode === 'assignment' && (
        <div>
          <div className="mb-4">
            <div className="text-[#9CA3AF] text-xs mb-1">{t('assignmentFee')}</div>
            <div className="text-xl font-bold text-[#0E3470]">{deal.assignment_fee}</div>
          </div>
          <div className="mb-4">
            <div className="text-[#9CA3AF] text-xs mb-1">{t('projectedIrr')}</div>
            <div className="text-[52px] font-[800] text-[#0B8A4D] leading-none">
              {infReturn ?? (assignmentIRRProp !== null ? assignmentIRRProp.toFixed(2) + '%' : '--')}
            </div>
          </div>
          <div className="text-xs text-[#9CA3AF] mt-2">
            {t('feeBreakdownIncluded')}
          </div>
        </div>
      )}

      {/* GP/LP Mode */}
      {mode === 'gplp' && (
        <div>
          <div className="space-y-2 mb-4">
            {[
              { label: t('acquisitionFee'), value: `${deal.acq_fee} ($${Math.round(acqFeeDollar).toLocaleString()})` },
              { label: t('assetMgmtFee'), value: `${deal.asset_mgmt_fee} ($${Math.round(assetMgmtFeeDollar).toLocaleString()}/yr)` },
              { label: t('gpCarry'), value: deal.gp_carry },
              { label: t('equityRequired'), value: formatPrice(deal.equity_required) },
            ].map((row) => (
              <div
                key={row.label}
                className="flex justify-between text-sm"
              >
                <span className="text-[#9CA3AF]">{row.label}</span>
                <span className="font-semibold text-[#0E3470]">{row.value ?? '--'}</span>
              </div>
            ))}
          </div>
          <div className="mb-4">
            <div className="text-[#9CA3AF] text-xs mb-1">{t('projectedIrr')}</div>
            <div className="text-[52px] font-[800] text-[#0B8A4D] leading-none">
              {infReturn ?? (baseIRRProp > 0 ? baseIRRProp.toFixed(2) + '%' : '--')}
            </div>
          </div>
        </div>
      )}

      {/* Custom Terms Mode */}
      {mode === 'custom' && (
        <div>
          <div className="space-y-5 mb-6">
            {/* LP Split slider */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[#6B7280]">{t('lpSplit')}</span>
                <span className="font-semibold text-[#0E3470]">{lpSplit}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                step={1}
                value={lpSplit}
                onChange={(e) =>
                  handleSliderChange(setLpSplit, Number(e.target.value))
                }
                className="w-full h-1.5"
                style={{ accentColor: '#BC9C45' }}
              />
              <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-1">
                <span>50%</span>
                <span>95%</span>
              </div>
            </div>

            {/* Preferred Return slider */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[#6B7280]">{t('preferredReturn')}</span>
                <span className="font-semibold text-[#0E3470]">{prefReturn}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={12}
                step={0.5}
                value={prefReturn}
                onChange={(e) =>
                  handleSliderChange(setPrefReturn, Number(e.target.value))
                }
                className="w-full h-1.5"
                style={{ accentColor: '#BC9C45' }}
              />
              <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-1">
                <span>5%</span>
                <span>12%</span>
              </div>
            </div>

            {/* Acquisition Fee slider */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[#6B7280]">{t('acquisitionFee')}</span>
                <span className="font-semibold text-[#0E3470]">{acqFee}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={0.25}
                value={acqFee}
                onChange={(e) =>
                  handleSliderChange(setAcqFee, Number(e.target.value))
                }
                className="w-full h-1.5"
                style={{ accentColor: '#BC9C45' }}
              />
              <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-1">
                <span>0%</span>
                <span>3%</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[#9CA3AF] text-xs mb-1">{t('calculatedIrr')}</div>
            <div className="text-[52px] font-[800] text-[#0B8A4D] leading-none">
              {infReturn ?? `${customIRR.toFixed(2)}%`}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[#EEF0F4] text-xs text-[#9CA3AF]">
        {t('allFeesIncluded')}
      </div>
    </div>
  );
}

/* ---------- Meeting Scheduler ---------- */

function MeetingScheduler({
  dealId,
  slots,
  bookedTimes,
  onMeetingRequested,
  previewMode = false,
}: {
  dealId: string;
  slots: TerminalAvailabilitySlot[];
  bookedTimes: string[];
  onMeetingRequested: () => void;
  previewMode?: boolean;
}) {
  const t = useTranslations('portal.dealDetail');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  // Build a week grid starting from today
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  // Map slots by day_of_week (0=Sunday, 6=Saturday)
  const slotsByDay = useMemo(() => {
    const map = new Map<number, TerminalAvailabilitySlot[]>();
    for (const s of slots) {
      const existing = map.get(s.day_of_week) ?? [];
      existing.push(s);
      map.set(s.day_of_week, existing);
    }
    return map;
  }, [slots]);

  // Fetch Google Calendar busy times to overlay on availability
  const [gcalBusy, setGcalBusy] = useState<{ start: string; end: string }[]>([]);
  const [gcalLoading, setGcalLoading] = useState(true);

  useEffect(() => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    fetch(`/api/calendar/availability?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.busyTimes) setGcalBusy(data.busyTimes);
      })
      .catch(() => {})
      .finally(() => setGcalLoading(false));
  }, []);

  const isGcalBusy = useCallback(
    (slotIso: string) => {
      const slotStart = new Date(slotIso).getTime();
      const slotEnd = slotStart + 30 * 60 * 1000;
      return gcalBusy.some((busy) => {
        const bStart = new Date(busy.start).getTime();
        const bEnd = new Date(busy.end).getTime();
        return slotStart < bEnd && slotEnd > bStart;
      });
    },
    [gcalBusy]
  );

  // Generate 30-min increments for each available slot
  const generateTimeSlots = useCallback(
    (day: Date): { label: string; isoString: string }[] => {
      const dow = day.getDay();
      const daySlots = slotsByDay.get(dow) ?? [];
      const result: { label: string; isoString: string }[] = [];

      for (const slot of daySlots) {
        const [startH, startM] = slot.start_time.split(':').map(Number);
        const [endH, endM] = slot.end_time.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        for (let m = startMinutes; m < endMinutes; m += 30) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const dateObj = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min, 0, 0);
          const iso = dateObj.toISOString();

          // Skip if already booked or busy on Google Calendar
          const isBooked = bookedTimes.some((bt) => {
            const bookedDate = new Date(bt);
            return Math.abs(bookedDate.getTime() - dateObj.getTime()) < 60000;
          });

          if (!isBooked && !isGcalBusy(iso)) {
            const ampm = h >= 12 ? t('pm') : t('am');
            const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
            const displayMin = String(min).padStart(2, '0');
            result.push({
              label: `${displayH}:${displayMin} ${ampm}`,
              isoString: iso,
            });
          }
        }
      }

      // Deduplicate by isoString in case admin slots overlap
      const seen = new Set<string>();
      return result.filter((s) => {
        if (seen.has(s.isoString)) return false;
        seen.add(s.isoString);
        return true;
      });
    },
    [slotsByDay, bookedTimes, isGcalBusy]
  );

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    if (previewMode) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/calendar/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, startTime: selectedSlot }),
      });

      if (res.ok) {
        onMeetingRequested();
        setSuccess(true);
        setSelectedSlot(null);
      }
    } finally {
      setConfirming(false);
    }
  };

  const dayLabels = [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')];
  const [selectedDay, setSelectedDay] = useState(0);
  const monthNames = [t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'), t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec')];

  if (success) {
    return (
      <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#0B8A4D]/10 flex items-center justify-center mx-auto mb-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0B8A4D"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h4 className="text-lg font-bold text-[#0E3470] mb-1">
          {t('meetingScheduled')}
        </h4>
        <p className="text-sm text-[#6B7280]">
          {t('confirmationEmail')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Day selector — horizontal scroll */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {weekDays.map((day, i) => {
          const daySlots = generateTimeSlots(day);
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`flex flex-col items-center px-4 py-2.5 rounded-xl transition-all shrink-0 ${
                selectedDay === i
                  ? 'bg-[#0E3470] text-white'
                  : daySlots.length === 0
                    ? 'bg-[#F7F8FA] text-[#D1D5DB] cursor-not-allowed'
                    : 'bg-white border border-[#EEF0F4] text-[#374151] hover:border-[#BC9C45]'
              }`}
              disabled={daySlots.length === 0}
            >
              <span className="text-[10px] font-medium uppercase">{dayLabels[day.getDay()]}</span>
              <span className="text-[16px] font-bold">{day.getDate()}</span>
              <span className="text-[9px] opacity-60">{monthNames[day.getMonth()]}</span>
            </button>
          );
        })}
      </div>

      {/* Time slots for selected day */}
      {gcalLoading ? (
        <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-[#F3F4F6] animate-pulse" />
          ))}
        </div>
      ) : (() => {
        const daySlots = generateTimeSlots(weekDays[selectedDay]);
        if (daySlots.length === 0) {
          return (
            <div className="text-center py-6 text-[13px] text-[#9CA3AF]">
              {t('noSlotsAvailable')}
            </div>
          );
        }
        return (
          <div key={selectedDay} className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
            {daySlots.map((ts) => (
              <button
                key={ts.isoString}
                onClick={() => setSelectedSlot(ts.isoString)}
                className={`text-sm px-3 py-2.5 rounded-lg transition-all font-medium text-center ${
                  selectedSlot === ts.isoString
                    ? 'border-2 border-[#BC9C45] bg-[#FDF8ED] text-[#0E3470] shadow-sm'
                    : 'bg-white border border-[#EEF0F4] hover:border-[#BC9C45] text-[#374151]'
                }`}
              >
                {ts.label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* Confirm button — sticky at bottom */}
      {selectedSlot && (
        <div className="mt-4 p-3 bg-[#FDF8ED] border border-[#ECD9A0]/30 rounded-xl">
          <div className="text-[11px] text-[#6B7280] mb-2">
            {t('selected')} <span className="font-semibold text-[#0E3470]">
              {new Date(selectedSlot).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {t('at')}{' '}
              {new Date(selectedSlot).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
          <button
            onClick={handleConfirm}
            disabled={confirming || previewMode}
            title={previewMode ? 'Preview mode — read-only' : undefined}
            className="w-full py-3 bg-[#BC9C45] hover:bg-[#A88A3D] text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirming ? t('scheduling') : t('confirmMeeting')}
          </button>
        </div>
      )}

      <div className="mt-3 text-center">
        <span className="text-xs text-[#9CA3AF]">
          {t('noneOfTheseWork')}{' '}
          <a
            href="https://wa.me/19177030365?text=Hi, I'd like to schedule a meeting"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#BC9C45] hover:underline"
          >
            {t('messageOnWhatsApp')}
          </a>
        </span>
      </div>
    </div>
  );
}

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
  prevDeal = null,
  nextDeal = null,
  previewMode = false,
}: DealDetailClientProps) {
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
    const valid: TabKey[] = ['overview', 'due-diligence', 'rent-roll', 'financial-modeling', 'deal-structure', 'capex', 'exit-strategy', 'schedule'];
    if (!valid.includes(qTab as TabKey)) return;
    if (qTab === 'due-diligence' && !ndaSigned) {
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

  // Lazy-fetch DD folders + documents when due-diligence tab is first opened
  useEffect(() => {
    if (activeTab !== 'due-diligence' || lazyDDFolders !== null || ddLoading) return;
    setDDLoading(true);
    (async () => {
      const supabase = createClient();
      const { data: folders } = await supabase
        .from('terminal_dd_folders')
        .select('id, deal_id, name, icon, display_order, address_id')
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
        .select('id, folder_id, deal_id, name, file_size, file_type, storage_path, is_downloadable, doc_status, uploaded_by, created_at')
        .in('folder_id', folderIds)
        .filter('storage_path', 'not.is', 'null')
        .order('created_at', { ascending: true });

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

  // Headline metrics — property-level (fees forced to 0) so admin-entered fees
  // never move cap rate / CoC / IRR / DSCR / equity. Fee impact is surfaced
  // only in the Fee Disclosure section and the Returns Calculator below.
  const dealInputs = useMemo(() => parseDealInputs(deal as unknown as Record<string, unknown>), [deal]);
  const computed = useMemo(() => calculatePropertyMetrics(dealInputs), [dealInputs]);
  // Fee-adjusted metrics for the Returns Calculator (Option A, Option B).
  const feeAdjustedMetrics = useMemo(() => calculateDeal(dealInputs), [dealInputs]);
  const traditionalMetrics = useMemo(() => dealInputs.sellerFinancing ? calculateTraditionalClose(dealInputs) : null, [dealInputs]);
  const financialProps = useMemo(() => ({
    inputs: dealInputs,
    metrics: computed,
    traditional: traditionalMetrics,
    isEstimated: !(deal as unknown as Record<string, unknown>).debt_terms_quoted,
  }), [dealInputs, computed, traditionalMetrics, deal]);

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

  const tabs: { key: TabKey; label: string; enabled: boolean }[] = [
    { key: 'overview', label: t('overview'), enabled: true },
    { key: 'due-diligence', label: t('dueDiligence'), enabled: true },
    { key: 'rent-roll', label: 'Rent Roll', enabled: showRentRoll },
    { key: 'financial-modeling', label: t('financialModeling'), enabled: true },
    { key: 'deal-structure', label: t('dealStructure'), enabled: true },
    { key: 'capex', label: 'CapEx & Condition', enabled: showCapex },
    { key: 'exit-strategy', label: 'Exit Strategy', enabled: showExitStrategy },
    { key: 'schedule', label: t('scheduleContact'), enabled: true },
  ];

  // Social proof visibility
  const showSocialProof = (deal.viewing_count ?? 0) > 0 || (deal.meetings_count ?? 0) > 0;

  return (
    <div className="min-h-dvh rp-page-texture font-[family-name:var(--font-poppins)]">
      {/* ------------------------------------------------------------------ */}
      {/* HERO GRADIENT BANNER                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="h-[3px] bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />

      {/* ------------------------------------------------------------------ */}
      {/* 5A. STICKY TOP NAV BAR                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#EEF0F4] shadow-[0_1px_3px_rgba(14,52,112,0.04),0_4px_12px_rgba(14,52,112,0.02)]">
        <div className="h-[64px] flex items-center px-4 md:px-8">
          <button
            onClick={() => router.push(`/${locale}/portal`)}
            className="hover:bg-[#F7F8FA] rounded-full p-2 transition mr-3 group"
            aria-label="Back to portal"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#9CA3AF] group-hover:text-[#0E3470] transition-colors"
            >
              <path d="M10 12L6 8l4-4" />
            </svg>
          </button>
          {/* Vertical separator */}
          <div className="hidden md:block h-5 w-px bg-[#EEF0F4] mr-4" />
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-playfair)] text-[18px] font-semibold text-[#0E3470] truncate">
              {deal.name}
            </h1>
            <p className="text-[10px] text-[#9CA3AF] truncate">
              {deal.city}, {deal.state} &middot; {tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type}
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3 ml-2 md:ml-4 shrink-0">
            {/* Express Interest button — replaced by "Deal Assigned" for assigned deals */}
            {deal.status === 'assigned' ? (
              <span className="px-3 md:px-5 py-2 bg-[#FDF8ED] border border-[#BC9C45]/40 text-[#BC9C45] text-[11px] md:text-[12px] font-semibold rounded-lg flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4 4 6-7"/></svg>
                <span className="hidden sm:inline">{t('dealAssigned')}</span>
                <span className="sm:hidden">✓</span>
              </span>
            ) : expressedInterest ? (
              <span className="px-3 md:px-5 py-2 bg-[#ECFDF5] text-[#0B8A4D] text-[11px] md:text-[12px] font-semibold rounded-lg flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#0B8A4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4 4 6-7"/></svg>
                <span className="hidden sm:inline">{t('interestExpressed')}</span>
                <span className="sm:hidden">✓</span>
              </span>
            ) : (
              <button
                onClick={() => setShowExpressModal(true)}
                disabled={checkingInterest || previewMode}
                title={previewTitle}
                className="px-3 md:px-5 py-2 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[11px] md:text-[12px] font-semibold rounded-lg transition-colors shadow-[0_2px_6px_rgba(188,156,69,0.25)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {t('expressInterest')}
              </button>
            )}
            {/* Header download button removed — View OM and per-document buttons live in the Transaction Documents card below. */}
            <div className="hidden md:block h-4 w-px bg-[#EEF0F4]" />
            <span className="hidden md:inline text-[9px] font-semibold tracking-[2px] uppercase text-[#9CA3AF]">
              {t('confidential')}
            </span>
            <div className="hidden md:block h-4 w-px bg-[#EEF0F4]" />
            <div className="hidden md:flex w-8 h-8 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded-lg items-center justify-center shadow-[0_2px_6px_rgba(188,156,69,0.2)]">
              <span className="text-white text-[11px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PAGE TEXTURE CONTENT AREA                                          */}
      {/* ------------------------------------------------------------------ */}
      <div>
        {/* ------------------------------------------------------------------ */}
        {/* DEAL HEADER BAR                                                    */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-white border-b border-[#EEF0F4] px-4 md:px-8 py-4 md:py-5">
          <div className="flex items-center gap-3 md:gap-0">
            {/* Mobile-only previous-deal button (desktop shows it alongside the hero) */}
            <div className="md:hidden shrink-0">
              <DealNavArrow
                direction="prev"
                target={prevDeal}
                locale={locale}
                previewMode={previewMode}
                activeTab={activeTab}
                label={t('previousDeal')}
                compact
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-playfair)] text-[22px] md:text-[28px] font-semibold text-[#0E3470] leading-tight tracking-[-0.01em]">
                {deal.name}
              </h2>
              <p className="text-[12px] text-[#9CA3AF] mt-1">
                {deal.city}, {deal.state} &middot; {tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type}
                {deal.square_footage ? ` \u00B7 ${deal.square_footage} SF` : ''}
                {deal.units ? ` \u00B7 ${tc('units', { count: deal.units })}` : ''}
                {deal.class_type ? ` \u00B7 ${tc('classType', { type: deal.class_type })}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {deal.seller_financing && (
                <span className="bg-[#BC9C45] text-white text-[10px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap">
                  {t('sellerFinancing')}
                </span>
              )}
              <span className="bg-[#F7F8FA] border border-[#EEF0F4] text-[#6B7280] text-[10px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap">
                {tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type}
              </span>
            </div>
            </div>
            {/* Mobile-only next-deal button */}
            <div className="md:hidden shrink-0">
              <DealNavArrow
                direction="next"
                target={nextDeal}
                locale={locale}
                previewMode={previewMode}
                activeTab={activeTab}
                label={t('nextDeal')}
                compact
              />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 2. HERO SECTION                                                    */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex items-center gap-3 lg:gap-4 p-4 md:p-8">
          {/* Previous-deal button — reserves its own column at the left edge */}
          <div className="hidden md:flex shrink-0 self-center">
            <DealNavArrow
              direction="prev"
              target={prevDeal}
              locale={locale}
              previewMode={previewMode}
              activeTab={activeTab}
              label={t('previousDeal')}
            />
          </div>
        <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4 md:gap-6 items-stretch">
          {/* Left: Image Carousel + Countdown Rings (rings pinned to bottom to align w/ right col) */}
          <div className="flex flex-col gap-4 h-full">
            <ImageCarousel urls={photoUrls} />
            <div className="mt-auto bg-white rounded-2xl border border-[#EEF0F4] p-4 md:p-6 rp-card-shadow">
              <div className="flex items-center justify-around gap-2 flex-wrap sm:flex-nowrap">
                <CountdownRing
                  label={t('dueDiligence')}
                  targetDate={deal.dd_deadline}
                  accentColor="#BC9C45"
                />
                <CountdownRing
                  label={t('closing')}
                  targetDate={deal.close_deadline}
                  accentColor="#0E3470"
                />
                <CountdownRing
                  label={t('extension')}
                  targetDate={deal.extension_deadline}
                  accentColor="#1D5FB8"
                />
              </div>
              {deal.timeline_note && (
                <div className="mt-4 px-4 py-3 bg-[#FDF8ED] border-l-[3px] border-[#BC9C45] rounded-md text-[13px] text-[#6B7280] leading-[1.6]">
                  <span className="font-bold text-[#BC9C45] mr-2 tracking-[1px]">
                    ℹ {t('timelineNoteLabel')}
                  </span>
                  {deal.timeline_note}
                </div>
              )}
            </div>
          </div>

          {/* Right: Metric Cards + Terminal Intelligence + Transaction Documents */}
          <div className="flex flex-col gap-3 justify-between">
            {/* Seven-Metric Cards — primary signal above the fold */}
            <div className="grid grid-cols-2 gap-2 md:gap-2.5">
              {(() => {
                const fullyFinanced = computed.netEquity <= 0;
                const hasPositiveCF = computed.distributableCashFlow > 0;
                const infReturn = fullyFinanced ? (hasPositiveCF ? '∞' : 'N/A') : null;
                const irrNote = fullyFinanced ? undefined : buildIrrAssumptions(deal, computed);
                return [
                  { label: tc('purchasePrice'), value: formatPrice(deal.purchase_price), borderColor: '#0E3470', span: 'col-span-2', size: 'headline' },
                  { label: tc('equityRequired'), value: fullyFinanced ? '$0' : (computed.netEquity > 0 ? '$' + Math.round(computed.netEquity).toLocaleString() : formatPrice(deal.equity_required)), borderColor: '#BC9C45', valueColor: fullyFinanced ? '#0B8A4D' : undefined, span: 'col-span-2', size: 'headline' },
                  { label: tc('noi'), value: formatPrice(deal.noi), borderColor: '#0E3470', span: 'col-span-1' },
                  { label: t('occupancy'), value: deal.occupancy ? `${deal.occupancy}%` : '—', borderColor: '#0E3470', span: 'col-span-1' },
                  { label: tc('capRate'), value: computed.capRate > 0 ? computed.capRate.toFixed(2) + '%' : formatPercent(deal.cap_rate), borderColor: '#BC9C45', span: 'col-span-1' },
                  { label: tc('irr'), value: infReturn ?? (computed.irr !== null ? computed.irr.toFixed(2) + '%' : (deal.irr ? formatPercent(deal.irr) : '—')), borderColor: '#0B8A4D', valueColor: '#0B8A4D', span: 'col-span-1', note: irrNote },
                  { label: tc('coc'), value: infReturn ?? (computed.cocReturn !== null ? computed.cocReturn.toFixed(2) + '%' : (deal.coc ? formatPercent(deal.coc) : '—')), borderColor: '#0B8A4D', valueColor: '#0B8A4D', span: 'col-span-1' },
                  { label: tc('dscr'), value: computed.combinedDSCR > 0 ? computed.combinedDSCR.toFixed(2) + 'x' : formatDSCR(deal.dscr), borderColor: '#0E3470', span: 'col-span-1' },
                ] as { label: string; value: string; borderColor: string; valueColor?: string; span: string; note?: string; size?: 'headline' | 'normal' }[];
              })().map((m, idx) => (
                <FadeInOnScroll key={m.label} delay={idx * 0.05} className={m.span}>
                  <MetricCard
                    label={m.label}
                    value={m.value}
                    borderColor={m.borderColor}
                    valueColor={m.valueColor}
                    note={m.note}
                    size={m.size}
                  />
                </FadeInOnScroll>
              ))}
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* 5C. TERMINAL INTELLIGENCE PANEL                                    */}
            {/* ------------------------------------------------------------------ */}
            {deal.acquisition_thesis && (
              <div className="bg-white rounded-xl p-5 border border-[#EEF0F4] rp-card-shadow">
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-[#BC9C45]/10 flex items-center justify-center">
                    <span className="text-[#BC9C45] text-lg">{'\u26A1'}</span>
                  </div>
                  <div>
                    <div className="text-[12px] font-[700] uppercase tracking-[2px] text-[#BC9C45]">
                      {t('terminalIntelligence')}
                    </div>
                    <div className="text-[9px] text-[#9CA3AF]">
                      {t('institutionalAnalysis')}
                    </div>
                  </div>
                </div>
                {/* Body */}
                <p
                  ref={thesisRef}
                  className={`text-[13px] text-[#4B5563] leading-[1.7] ${thesisExpanded ? '' : 'line-clamp-4'}`}
                >
                  {deal.acquisition_thesis}
                </p>
                {(thesisOverflows || thesisExpanded) && (
                  <button
                    type="button"
                    onClick={() => setThesisExpanded((v) => !v)}
                    className="mt-2 text-[11px] font-semibold text-[#BC9C45] hover:text-[#A88A3D] transition-colors"
                  >
                    {thesisExpanded ? t('hide') : t('readMore')}
                  </button>
                )}
                {/* Footer buttons */}
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  {deal.full_report_storage_path ? (
                    <button
                      onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/full-report?view=true`, `${deal.name} — ${t('fullReport')}`)}
                      className="px-4 py-2 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[11px] font-semibold rounded-lg transition-colors"
                    >
                      {t('fullReport')}
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default">
                      {t('fullReportPending')}
                    </span>
                  )}
                  {deal.costar_report_storage_path ? (
                    <button
                      onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/costar-report?view=true`, `${deal.name} — ${t('costarReport')}`)}
                      className="px-4 py-2 bg-[#0E3470] hover:bg-[#0A2656] text-white text-[11px] font-semibold rounded-lg transition-colors"
                    >
                      {t('costarReport')}
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default">
                      {t('costarReportPending')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* 5D. TRANSACTION DOCUMENTS (OM + Signed LOI + PSA)                  */}
            {/* ------------------------------------------------------------------ */}
            <div className="bg-white rounded-xl p-5 border border-[#EEF0F4] rp-card-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[#0E3470]/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <div className="text-[12px] font-[700] uppercase tracking-[2px] text-[#0E3470]">
                    {t('transactionDocuments')}
                  </div>
                  <div className="text-[9px] text-[#9CA3AF]">
                    {t('transactionDocumentsSubtitle')}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(() => {
                  const portfolioAddrOms = deal.is_portfolio
                    ? (addresses ?? []).filter((a) => a.om_storage_path)
                    : [];

                  // Portfolio with per-address OMs uploaded → single button with a dropdown
                  if (portfolioAddrOms.length > 0) {
                    return (
                      <div ref={omMenuRef} className="relative">
                        <button
                          onClick={() => setOmMenuOpen((o) => !o)}
                          className="w-full px-3 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[11px] font-semibold rounded-lg transition-colors text-center flex items-center justify-center gap-1.5"
                        >
                          {t('viewOm')}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${omMenuOpen ? 'rotate-180' : ''}`}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        {omMenuOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#EEF0F4] rounded-lg shadow-lg z-10 overflow-hidden">
                            {portfolioAddrOms.map((a) => (
                              <button
                                key={a.id}
                                onClick={() => {
                                  setOmMenuOpen(false);
                                  handleViewDocument(`/api/deals/${deal.id}/om?addressId=${a.id}&view=true`, `${a.label} — ${t('offeringMemorandum')}`);
                                }}
                                className="w-full px-3 py-2.5 text-left text-[11px] font-medium text-[#0E3470] hover:bg-[#FDF8ED] transition-colors border-b border-[#EEF0F4] last:border-b-0"
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Single property, or portfolio fallback while per-address OMs pending
                  if (deal.om_storage_path) {
                    return (
                      <button
                        onClick={() => handleViewDocument(`/api/deals/${deal.id}/om?view=true`, `${deal.name} — ${t('offeringMemorandum')}`)}
                        className="px-3 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[11px] font-semibold rounded-lg transition-colors text-center"
                      >
                        {t('viewOm')}
                      </button>
                    );
                  }

                  return (
                    <span className="px-3 py-2.5 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default text-center">
                      {t('omPending')}
                    </span>
                  );
                })()}
                {deal.loi_signed_storage_path ? (
                  <button
                    onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/loi?view=true`, `${deal.name} — ${t('signedLoi')}`)}
                    className="px-3 py-2.5 border border-[#EEF0F4] hover:border-[#BC9C45] text-[#0E3470] text-[11px] font-semibold rounded-lg transition-colors text-center"
                  >
                    {t('viewSignedLoi')}
                  </button>
                ) : (
                  <span className="px-3 py-2.5 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default text-center">
                    {t('signedLoiPending')}
                  </span>
                )}
                {deal.psa_storage_path ? (
                  <button
                    onClick={() => handleViewDocument(`/api/deals/${deal.id}/document/psa?view=true`, `${deal.name} — ${t('psa')}`)}
                    className="px-3 py-2.5 border border-[#EEF0F4] hover:border-[#BC9C45] text-[#0E3470] text-[11px] font-semibold rounded-lg transition-colors text-center"
                  >
                    {t('viewPsa')}
                  </button>
                ) : (
                  <span className="px-3 py-2.5 bg-[#F7F8FA] text-[#9CA3AF] text-[11px] font-semibold rounded-lg cursor-default text-center">
                    {t('psaPending')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
          {/* Next-deal button — reserves its own column at the right edge */}
          <div className="hidden md:flex shrink-0 self-center">
            <DealNavArrow
              direction="next"
              target={nextDeal}
              locale={locale}
              previewMode={previewMode}
              activeTab={activeTab}
              label={t('nextDeal')}
            />
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 5D2. DEPOSIT INFO                                                  */}
        {/* ------------------------------------------------------------------ */}
        <div className="px-4 md:px-8 mt-6">
          <div className="bg-[#FDF8ED] border border-[#ECD9A0] rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="w-10 h-10 rounded-lg bg-[#BC9C45]/10 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                  <path d="M6 14h4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
                {deal.deposit_amount && (
                  <div className="shrink-0">
                    <div className="text-[9px] font-semibold tracking-[2px] uppercase text-[#BC9C45]">{t('depositAmount')}</div>
                    <div className="text-[18px] font-semibold text-[#0E3470] tabular-nums">{deal.deposit_amount}</div>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[9px] font-semibold tracking-[2px] uppercase text-[#BC9C45]">{t('heldBy')}</div>
                  <div className="text-[13px] sm:text-[15px] font-medium text-[#0E3470] break-words">Bruce J. Smoler, Esq. · Smoler & Associates, P.A. — Florida IOTA Trust Account</div>
                </div>
              </div>
            </div>
          </div>

        {/* ------------------------------------------------------------------ */}
        {/* 5E. TAB BAR                                                        */}
        {/* ------------------------------------------------------------------ */}
        <div ref={tabBarRef} className="px-4 md:px-8 mt-6 md:mt-8">
          <div className="flex border-b border-[#E5E7EB] overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            {tabs.map((tab) => {
              const disabled = !tab.enabled;
              return (
                <button
                  key={tab.key}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    if (tab.key === 'due-diligence' && !ndaSigned) {
                      setShowNDAModal(true);
                      return;
                    }
                    setActiveTab(tab.key);
                  }}
                  className={`relative px-5 py-3 text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    disabled
                      ? 'text-[#9CA3AF] opacity-40 cursor-not-allowed'
                      : activeTab === tab.key
                        ? 'text-[#0F1B2D] font-semibold'
                        : 'text-[#9CA3AF] hover:text-[#6B7280]'
                  }`}
                  title={disabled ? 'Coming soon' : undefined}
                >
                  {tab.label}
                  {tab.key === 'due-diligence' && !ndaSigned && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-50">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  )}
                  {!disabled && activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C8A951] rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TAB CONTENT                                                        */}
        {/* ------------------------------------------------------------------ */}

        {/* ========== 5F. OVERVIEW TAB ========== */}
        <div
          className="transition-opacity duration-200"
          style={{ display: activeTab === 'overview' ? 'block' : 'none' }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Portfolio Address Cards — only for portfolios */}
              {deal.is_portfolio && addresses.length > 0 && (
                <FadeInOnScroll delay={0}>
                  <div>
                    <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-4">
                      {t('portfolioProperties')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {addresses.map((addr, i) => (
                        <div
                          key={addr.id}
                          className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow hover:border-[#BC9C45]/30 transition-all"
                          style={{ animationDelay: `${i * 0.08}s` }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#0E3470]/5 flex items-center justify-center text-[18px] shrink-0">
                              🏢
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-[14px] font-semibold text-[#0E3470] truncate">{addr.label}</h4>
                              <p className="text-[11px] text-[#6B7280] mt-0.5">
                                {[addr.address, addr.city, addr.state].filter(Boolean).join(', ')}
                              </p>
                              {(addr.square_footage || addr.units) && (
                                <p className="text-[10px] text-[#9CA3AF] mt-1">
                                  {addr.square_footage && `${addr.square_footage} SF`}
                                  {addr.square_footage && addr.units && ' · '}
                                  {addr.units && `${addr.units} Units`}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeInOnScroll>
              )}

              {/* Investment Highlights - 2-column grid of mini cards */}
              {deal.investment_highlights &&
                deal.investment_highlights.length > 0 && (
                  <FadeInOnScroll delay={0}>
                    <div>
                      <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-4">
                        {t('investmentHighlights')}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {deal.investment_highlights.map((highlight, idx) => (
                          <div
                            key={idx}
                            className="bg-white border border-[#EEF0F4] rounded-xl p-4 rp-card-shadow"
                            style={{ borderLeft: '2px solid #BC9C45' }}
                          >
                            <div className="flex gap-3 items-start">
                              <div className="w-7 h-7 rounded-full bg-[#ECFDF5] flex items-center justify-center shrink-0">
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="#0B8A4D"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 8l4 4 6-7" />
                                </svg>
                              </div>
                              <span className="text-sm text-[#374151] leading-relaxed">
                                {highlight}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </FadeInOnScroll>
                )}

              {/* Acquisition Thesis */}
              {deal.acquisition_thesis && (
                <FadeInOnScroll delay={0.1}>
                  <div>
                    <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-3">
                      {t('acquisitionThesis')}
                    </h3>
                    <p className="text-sm text-[#4B5563] leading-[1.8]">
                      {deal.acquisition_thesis}
                    </p>
                  </div>
                </FadeInOnScroll>
              )}

              {/* Fully-financed highlight (only when netEquity <= 0 and CF > 0) */}
              {computed.netEquity <= 0 && computed.distributableCashFlow > 0 && (
                <FadeInOnScroll delay={0.18}>
                  <div className="bg-[#FDF8ED] border border-[#ECD9A0] rounded-xl px-5 py-4">
                    <div className="text-[10px] font-bold text-[#BC9C45] uppercase tracking-[1.5px]">
                      {t('annualCashFlowToInvestor')}
                    </div>
                    <div className="text-[26px] md:text-[30px] font-bold text-[#0B8A4D] tabular-nums leading-tight mt-1">
                      ${Math.round(computed.distributableCashFlow).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-[#6B7280] mt-1">
                      {t('zeroEquityCallout')}
                    </div>
                  </div>
                </FadeInOnScroll>
              )}

              {/* Capital Stack + Return Comparison + Cash Flow Summary */}
              <FadeInOnScroll delay={0.2}>
                <OverviewFinancials {...financialProps} />
              </FadeInOnScroll>

              {/* Beta disclaimer — understated, below Cash Flow Summary */}
              <FadeInOnScroll delay={0.22}>
                <p className="text-[12px] text-[#9CA3AF] leading-relaxed px-1">
                  <span className="text-[#BC9C45]">*</span> {t('betaDisclaimer')}
                </p>
              </FadeInOnScroll>

              {/* Market Context - with emoji icons */}
              <FadeInOnScroll delay={0.3}>
                <div>
                  <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-4">
                    {t('marketContext')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
                    <div className="bg-white rounded-xl border border-[#EEF0F4] p-3 md:p-4 rp-card-shadow min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base">{'\uD83D\uDC65'}</span>
                        <span className="data-label">{t('metroPopulation')}</span>
                      </div>
                      <div className="text-lg font-bold text-[#0E3470]">
                        {formatNumber(deal.metro_population)}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#EEF0F4] p-3 md:p-4 rp-card-shadow min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base">{'\uD83D\uDCC8'}</span>
                        <span className="data-label">{t('jobGrowth')}</span>
                      </div>
                      <div className="text-lg font-bold text-[#0B8A4D]">
                        {deal.job_growth ? `+${deal.job_growth}` : '--'}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#EEF0F4] p-3 md:p-4 rp-card-shadow min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base">{'\uD83C\uDFE2'}</span>
                        <span className="data-label">{t('occupancy')}</span>
                      </div>
                      <div className="text-lg font-bold text-[#0E3470]">
                        {deal.occupancy ? `${deal.occupancy}%` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInOnScroll>

              {/* Pipeline Progress Tracker */}
              {stageProgress && currentStage && (
                <FadeInOnScroll delay={0.3}>
                  <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 mt-4 rp-card-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-[#0E3470]">
                        {t('dealProgress')}
                      </h3>
                      <span className="text-[12px] font-semibold text-[#0B8A4D] tabular-nums">
                        {pipelineProgress !== undefined && pipelineProgress >= 0 ? `${pipelineProgress}%` : '—'}
                      </span>
                    </div>

                    {/* Overall progress bar */}
                    <div className="bg-[#EEF0F4] rounded-full h-2.5 overflow-hidden mb-5">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pipelineProgress !== undefined && pipelineProgress >= 0 ? pipelineProgress : 0}%`,
                          background: 'linear-gradient(90deg, #0E3470, #0B8A4D, #34D399)',
                        }}
                      />
                    </div>

                    {/* Stage breakdown */}
                    <div className="space-y-2.5">
                      {([
                        { key: 'post_loi', label: t('postLoi'), duration: '10 Days' },
                        { key: 'due_diligence', label: t('dueDiligence'), duration: '30 Days' },
                        { key: 'pre_closing', label: t('preClosing'), duration: '30-60 Days' },
                        { key: 'post_closing', label: t('postClosing'), duration: '7 Days' },
                      ] as const).map((stage) => {
                        const sp = stageProgress[stage.key] || { total: 0, completed: 0 };
                        const pct = sp.total > 0 ? Math.round((sp.completed / sp.total) * 100) : 0;
                        const isCurrent = currentStage === stage.key;
                        const isComplete = sp.total > 0 && sp.completed === sp.total;
                        const isPast = (() => {
                          const order = ['post_loi', 'due_diligence', 'pre_closing', 'post_closing'];
                          return order.indexOf(stage.key) < order.indexOf(currentStage);
                        })();

                        return (
                          <div key={stage.key} className="flex items-center gap-3">
                            {/* Status indicator */}
                            {isComplete || isPast ? (
                              <div className="w-5 h-5 rounded-full bg-[#0B8A4D] flex items-center justify-center shrink-0">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              </div>
                            ) : isCurrent ? (
                              <div className="w-5 h-5 rounded-full border-[2.5px] border-[#0E3470] shrink-0 relative">
                                <div className="absolute inset-[3px] rounded-full bg-[#0E3470]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-[#D1D5DB] shrink-0" />
                            )}

                            {/* Stage info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-[11px] font-semibold ${
                                  isCurrent ? 'text-[#0E3470]' : isComplete || isPast ? 'text-[#0B8A4D]' : 'text-[#9CA3AF]'
                                }`}>
                                  {stage.label}
                                </span>
                                <span className={`text-[10px] font-semibold tabular-nums ${
                                  isCurrent ? 'text-[#0E3470]' : isComplete || isPast ? 'text-[#0B8A4D]' : 'text-[#9CA3AF]'
                                }`}>
                                  {sp.total > 0 ? `${sp.completed}/${sp.total}` : '—'}
                                </span>
                              </div>
                              <div className="bg-[#EEF0F4] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: isComplete || isPast ? '#0B8A4D' : isCurrent ? '#0E3470' : '#D1D5DB',
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </FadeInOnScroll>
              )}
            </div>

            {/* Right Column (Sidebar) */}
            <div className="space-y-4">
              {/* Property Details */}
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
                <h3 className="text-sm font-semibold text-[#0E3470] mb-4">
                  {t('propertyDetails')}
                </h3>
                <div className="space-y-0">
                  {(() => {
                    const ppNum = parseFloat(deal.purchase_price ?? '0');
                    const sfNum = parseFloat((deal.square_footage ?? '').replace(/,/g, ''));
                    const pricePerSf = ppNum > 0 && sfNum > 0
                      ? `$${(ppNum / sfNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : null;

                    const rows: { key: string; label: string; value: string | null | undefined }[] = [];
                    if (deal.address) {
                      rows.push({ key: 'address', label: t('address'), value: deal.address });
                    }
                    rows.push(
                      { key: 'type', label: t('type'), value: tPt.has(deal.property_type) ? tPt(deal.property_type) : deal.property_type },
                      { key: 'class', label: t('class'), value: deal.class_type },
                      { key: 'yearBuilt', label: t('yearBuilt'), value: deal.year_built?.toString() },
                    );
                    if (deal.year_renovated) {
                      rows.push({ key: 'yearRenovated', label: t('yearRenovated'), value: deal.year_renovated });
                    }
                    rows.push(
                      { key: 'sqFt', label: t('sqFt'), value: formatSqFt(deal.square_footage) },
                      { key: 'units', label: t('units'), value: deal.units },
                    );
                    // WALT + Occupancy from tenant data (only if tenant rows exist)
                    if (tenants.length > 0) {
                      const wVal = computeWALT(tenants);
                      const occ = computeOccupancy(
                        tenants,
                        Number.isFinite(sfNum) && sfNum > 0 ? sfNum : null,
                      );
                      if (wVal !== null) {
                        rows.push({ key: 'walt', label: 'WALT', value: formatYears(wVal) });
                      }
                      if (occ.occupancyPct !== null) {
                        rows.push({
                          key: 'occupancy',
                          label: 'Occupancy',
                          value: `${occ.occupancyPct.toFixed(1)}%`,
                        });
                      }
                    } else if (deal.occupancy) {
                      rows.push({ key: 'occupancy', label: 'Occupancy', value: `${deal.occupancy}%` });
                    }
                    rows.push(
                      { key: 'neighborhood', label: t('neighborhood'), value: deal.neighborhood },
                    );
                    if (pricePerSf) {
                      rows.push({ key: 'pricePerSf', label: t('pricePerSf'), value: pricePerSf });
                    }
                    return rows.map((row, idx) => (
                      <div
                        key={row.key}
                        className={`flex justify-between gap-3 py-2.5 ${
                          idx % 2 === 0 ? 'bg-[#F7F8FA]' : ''
                        } px-2 rounded`}
                      >
                        <span className="data-label shrink-0">
                          {row.label}
                        </span>
                        <span className="text-sm font-semibold text-[#0E3470] text-right break-words min-w-0">
                          {row.value ?? '--'}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Negotiation Summary — only when seller asking cap rate is set */}
              {(() => {
                const askingCap = parseFloat(deal.asking_cap_rate ?? '');
                if (!(askingCap > 0)) return null;
                const negotiatedCap = computed.capRate;
                const areaCap = parseFloat(deal.area_cap_rate ?? '');
                const hasArea = areaCap > 0;

                const vsAskBps = Math.round((negotiatedCap - askingCap) * 100);
                const vsMarketBps = hasArea ? Math.round((negotiatedCap - areaCap) * 100) : null;

                const fmtBps = (bps: number) => {
                  const sign = bps >= 0 ? '+' : '';
                  return `${sign}${bps} ${t('bps')}`;
                };
                const arrow = (bps: number) => (bps >= 0 ? '▲' : '▼');
                const tone = (bps: number) =>
                  bps >= 0 ? { color: '#0B8A4D', bg: 'rgba(11,138,77,0.08)' } : { color: '#C0392B', bg: 'rgba(192,57,43,0.08)' };

                return (
                  <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
                    <h3 className="text-sm font-semibold text-[#0E3470] mb-4 flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-[2px] uppercase text-[#BC9C45]">★</span>
                      {t('negotiationSummary')}
                    </h3>
                    <div className="space-y-1.5 mb-4">
                      {hasArea && (
                        <div className="flex justify-between items-center py-2 px-2 bg-[#F7F8FA] rounded">
                          <span className="data-label">{t('areaCapRate')}</span>
                          <span className="text-sm font-semibold text-[#0E3470] tabular-nums">{areaCap.toFixed(2)}%</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 px-2 rounded">
                        <span className="data-label">{t('askingCapRate')}</span>
                        <span className="text-sm font-semibold text-[#0E3470] tabular-nums">{askingCap.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center py-2 px-2 bg-[#FDF8ED] rounded border-l-[3px] border-[#BC9C45]">
                        <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-[#BC9C45]">{t('negotiatedCapRate')}</span>
                        <span className="text-base font-bold text-[#0E3470] tabular-nums">{negotiatedCap.toFixed(2)}%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(() => {
                        const t1 = tone(vsAskBps);
                        return (
                          <div
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                            style={{ background: t1.bg }}
                          >
                            <span className="data-label">{t('vsSellerAsk')}</span>
                            <span
                              className="text-base font-bold tabular-nums flex items-center gap-1"
                              style={{ color: t1.color }}
                            >
                              <span>{arrow(vsAskBps)}</span>
                              {fmtBps(vsAskBps)}
                            </span>
                          </div>
                        );
                      })()}
                      {vsMarketBps !== null && (() => {
                        const t2 = tone(vsMarketBps);
                        return (
                          <div
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                            style={{ background: t2.bg }}
                          >
                            <span className="data-label">{t('vsMarket')}</span>
                            <span
                              className="text-base font-bold tabular-nums flex items-center gap-1"
                              style={{ color: t2.color }}
                            >
                              <span>{arrow(vsMarketBps)}</span>
                              {fmtBps(vsMarketBps)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

              {/* Cap Rate Sparkline */}
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
                <h4 className="text-sm font-semibold text-[#0E3470] mb-3">
                  {t('capRateTrend')}
                </h4>
                <svg viewBox="0 0 200 60" className="w-full h-14">
                  {/* Subtle fill under the line */}
                  <defs>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0B8A4D" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#0B8A4D" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points="0,45 30,40 60,38 90,35 120,30 150,28 180,25 200,22 200,60 0,60"
                    fill="url(#sparkFill)"
                  />
                  <polyline
                    points="0,45 30,40 60,38 90,35 120,30 150,28 180,25 200,22"
                    stroke="#0B8A4D"
                    strokeWidth="2"
                    fill="none"
                  />
                  <circle cx="200" cy="22" r="4" fill="#0B8A4D" />
                  <circle cx="200" cy="22" r="7" fill="#0B8A4D" fillOpacity="0.15" />
                </svg>
              </div>

              {/* Live Activity Feed - real data from activity log */}
              <RealActivityFeed dealId={deal.id} />

              {/* Social Proof -- hidden when both counts are 0 */}
              {showSocialProof && (
                <div className="bg-[#FEF2F2] rounded-xl p-4 border border-[#FECACA]">
                  <div className="text-center">
                    <div className="text-[32px] font-[800] text-[#DC2626]">
                      {deal.viewing_count}
                    </div>
                    <div className="text-xs text-[#6B7280] mb-2">{t('investorsReviewing')}</div>
                    <div className="text-[32px] font-[800] text-[#DC2626]">
                      {deal.meetings_count}
                    </div>
                    <div className="text-xs text-[#6B7280]">{t('meetingsScheduled')}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== 5G. DUE DILIGENCE TAB ========== */}
        <div
          className="transition-opacity duration-200"
          style={{ display: activeTab === 'due-diligence' ? 'block' : 'none' }}
        >
          <div className="mt-3 px-4 md:px-8 pb-8 md:pb-10">
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

        {/* ========== 5G1. RENT ROLL TAB ========== */}
        <div
          className="transition-opacity duration-200"
          style={{ display: activeTab === 'rent-roll' ? 'block' : 'none' }}
        >
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

        {/* ========== 5G1b. CAPEX & CONDITION TAB ========== */}
        <div
          className="transition-opacity duration-200"
          style={{ display: activeTab === 'capex' ? 'block' : 'none' }}
        >
          <div className="mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10">
            <CapExTab
              items={capexItems}
              holdPeriodYears={parseHoldPeriod(deal.hold_period_years, 5)}
              isPortfolio={!!deal.is_portfolio}
              buildings={addresses.map((a) => ({ id: a.id, label: a.label }))}
            />
          </div>
        </div>

        {/* ========== 5G1c. EXIT STRATEGY TAB ========== */}
        <div
          className="transition-opacity duration-200"
          style={{ display: activeTab === 'exit-strategy' ? 'block' : 'none' }}
        >
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

        {/* ========== 5G2. FINANCIAL MODELING TAB ========== */}
        <div
          className="transition-opacity duration-200"
          style={{ display: activeTab === 'financial-modeling' ? 'block' : 'none' }}
        >
          <div className="mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10">
            <FinancialModelingTab deal={deal} />
          </div>
        </div>

        {/* ========== 5H. DEAL STRUCTURE TAB ========== */}
        <div
          className="transition-opacity duration-200"
          style={{ display: activeTab === 'deal-structure' ? 'block' : 'none' }}
        >
          <div className="mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10">
            {/* Full Financial Detail — Capital Stack, Waterfall, Financing, Comparison, Fees */}
            <DealStructureFinancials {...financialProps} />

            {deal.special_terms && deal.special_terms !== 'None' && (
              <FadeInOnScroll delay={0.05}>
                <div className="mt-8 bg-[#FDF8ED] border-l-4 border-[#BC9C45] p-4 rounded-r-lg">
                  <div className="text-[11px] font-semibold text-[#BC9C45] uppercase tracking-wider mb-1">
                    {t('specialTerms')}
                  </div>
                  <p className="text-sm text-[#4B5563]">{deal.special_terms}</p>
                </div>
              </FadeInOnScroll>
            )}

            <div className="mt-8" />

            {/* Two option cards side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option A: Assignment */}
              <FadeInOnScroll delay={0}>
                <button
                  onClick={() => setSelectedStructure('assignment')}
                  className={`w-full bg-white rounded-xl border-2 p-6 text-left cursor-pointer transition-all relative ${
                    selectedStructure === 'assignment'
                      ? 'border-[#BC9C45] shadow-[0_0_0_3px_#FDF8ED,0_0_20px_rgba(188,156,69,0.15)]'
                      : 'border-[#EEF0F4] hover:border-[#D1D5DB]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-[700] uppercase tracking-[2px] text-[#BC9C45]">
                      {t('optionA')}
                    </span>
                    {/* Assignment fee large number top-right */}
                    <span className="text-[32px] font-[800] text-[#BC9C45] leading-none">
                      {deal.assignment_fee ?? '3%'}
                    </span>
                  </div>
                  <h3 className="font-[700] text-[#0E3470] text-[20px] mb-4">
                    {t('assignment')}
                  </h3>
                  <p className="text-sm text-[#6B7280] mb-4">
                    {t('assignmentDesc')}
                  </p>
                  <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
                    <div className="data-label !text-[#0B8A4D] mb-1">
                      {t('projectedIrr')}
                    </div>
                    <div className="text-2xl font-bold text-[#0B8A4D]">
                      {computed.netEquity <= 0
                        ? (computed.distributableCashFlow > 0 ? '∞' : 'N/A')
                        : (feeAdjustedMetrics.assignmentIRR !== null ? feeAdjustedMetrics.assignmentIRR.toFixed(2) + '%' : '--')}
                    </div>
                    {computed.netEquity > 0 && (
                      <div className="text-[10px] text-[#9CA3AF] mt-1 leading-tight">
                        {buildIrrAssumptions(deal as unknown as { exit_cap_rate?: string | null; hold_period_years?: string | null; rent_growth?: string | null }, computed)}
                      </div>
                    )}
                    <div className="text-[11px] text-[#6B7280] mt-1">
                      {t('feeIncluded')}
                    </div>
                  </div>
                </button>
              </FadeInOnScroll>

              {/* Option B: GP/LP Partnership */}
              <FadeInOnScroll delay={0.1}>
                <button
                  onClick={() => setSelectedStructure('gplp')}
                  className={`w-full bg-white rounded-xl border-2 p-6 text-left cursor-pointer transition-all ${
                    selectedStructure === 'gplp'
                      ? 'border-[#BC9C45] shadow-[0_0_0_3px_#FDF8ED,0_0_20px_rgba(188,156,69,0.15)]'
                      : 'border-[#EEF0F4] hover:border-[#D1D5DB]'
                  }`}
                >
                  <span className="text-[10px] font-[700] uppercase tracking-[2px] text-[#BC9C45] block mb-2">
                    {t('optionB')}
                  </span>
                  <h3 className="font-[700] text-[#0E3470] text-[20px] mb-4">
                    {t('gpLpPartnership')}
                  </h3>
                  <div className="space-y-2 mb-4">
                    {[
                      { label: t('acquisitionFee'), value: `${deal.acq_fee} ($${Math.round(feeAdjustedMetrics.acqFeeDollar).toLocaleString()})` },
                      { label: t('assetMgmtFee'), value: `${deal.asset_mgmt_fee} ($${Math.round(feeAdjustedMetrics.assetMgmtFeeDollar).toLocaleString()}/yr)` },
                      { label: t('gpCarry'), value: deal.gp_carry },
                      { label: t('equityRequired'), value: formatPrice(deal.equity_required) },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex justify-between py-1.5 border-b border-[#EEF0F4] last:border-b-0"
                      >
                        <span className="data-label">
                          {row.label}
                        </span>
                        <span className="text-sm font-semibold text-[#0E3470]">
                          {row.value ?? '--'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
                    <div className="data-label !text-[#0B8A4D] mb-1">
                      {t('projectedIrr')}
                    </div>
                    <div className="text-2xl font-bold text-[#0B8A4D]">
                      {computed.netEquity <= 0
                        ? (computed.distributableCashFlow > 0 ? '∞' : 'N/A')
                        : (feeAdjustedMetrics.irr !== null ? feeAdjustedMetrics.irr.toFixed(2) + '%' : '--')}
                    </div>
                    {computed.netEquity > 0 && (
                      <div className="text-[10px] text-[#9CA3AF] mt-1 leading-tight">
                        {buildIrrAssumptions(deal as unknown as { exit_cap_rate?: string | null; hold_period_years?: string | null; rent_growth?: string | null }, computed)}
                      </div>
                    )}
                    <div className="text-[11px] text-[#6B7280] mt-1">
                      {t('allFeesIncludedShort')}
                    </div>
                  </div>
                </button>
              </FadeInOnScroll>
            </div>

            {/* IRR Calculator Panel */}
            <FadeInOnScroll delay={0.2}>
              <div className="mt-6">
                <IRRCalculatorPanel
                  deal={deal}
                  baseIRR={feeAdjustedMetrics.irr ?? 0}
                  assignmentIRRProp={feeAdjustedMetrics.assignmentIRR}
                  acqFeeDollar={feeAdjustedMetrics.acqFeeDollar}
                  assetMgmtFeeDollar={feeAdjustedMetrics.assetMgmtFeeDollar}
                  onSliderChange={handleIRRSliderChange}
                  fullyFinanced={computed.netEquity <= 0}
                  hasPositiveCashFlow={computed.distributableCashFlow > 0}
                />
              </div>
            </FadeInOnScroll>
          </div>
        </div>

        {/* ========== 5I. SCHEDULE & CONTACT TAB ========== */}
        <div
          className="transition-opacity duration-200"
          style={{ display: activeTab === 'schedule' ? 'block' : 'none' }}
        >
          {scheduleLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <div className="mt-6 md:mt-8 px-4 md:px-8 pb-8 md:pb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Meeting Scheduler */}
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
              <h3 className="text-sm font-semibold text-[#0E3470] mb-4">
                {t('scheduleMeeting')}
              </h3>
              <MeetingScheduler
                dealId={deal.id}
                slots={lazySlots ?? availabilitySlots}
                bookedTimes={lazyBookedTimes ?? bookedTimes}
                onMeetingRequested={handleMeetingRequested}
                previewMode={previewMode}
              />
            </div>

            {/* Right: Contact & Info */}
            <div className="space-y-4">
              {/* Contact Card with navy gradient avatar */}
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center shrink-0 shadow-lg">
                    <span className="text-white font-bold text-lg">
                      {(lazyContact ? lazyContact.name : contactName).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'RP'}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-[#0E3470]">
                      {(lazyContact?.name || contactName) || t('reprimeTeam')}
                    </div>
                    <div className="text-xs text-[#9CA3AF]">
                      {(lazyContact?.title || contactTitle) || t('investmentAdvisor')}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href={`mailto:${lazyContact?.email || contactEmail}?subject=${encodeURIComponent(`RE: ${deal.name}`)}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white font-semibold text-sm rounded-xl transition-colors"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    {t('emailAboutDeal', { name: (lazyContact?.name || contactName)?.split(' ')[0] || 'Shirel' })}
                  </a>
                  <a
                    href={`mailto:${lazyContact?.email || contactEmail}?subject=${encodeURIComponent(`Callback Request: ${deal.name}`)}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0E3470] hover:bg-[#0E3470]/90 text-white font-semibold text-sm rounded-xl transition-colors"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    {t('requestACallBack')}
                  </a>
                </div>
              </div>

              {/* Email Availability Card */}
              <div className="bg-[#FDF8ED] border border-[#BC9C45]/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#0B8A4D] live-dot" />
                  <span className="text-sm font-semibold text-[#0E3470]">{t('availableViaEmail')}</span>
                </div>
                <p className="text-xs text-[#6B7280]">
                  {t('typicalResponseTime')}
                </p>
              </div>

              {/* Notification preferences moved to Settings */}
              <a
                href={`/${locale}/portal/settings`}
                className="block bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow hover:border-[#BC9C45] transition-colors group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="data-label mb-1">{t('notificationPreferences')}</div>
                    <div className="text-[12px] text-[#6B7280]">{t('manageInSettings')}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#9CA3AF] group-hover:text-[#BC9C45] transition-colors">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </a>

              {/* Confidential Access Notice */}
              <div className="bg-[#0E3470]/[0.04] border border-[#0E3470]/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E3470" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <span className="text-sm font-semibold text-[#0E3470]">
                    {t('confidential')}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280]">
                  {t('confidentialAccess')}
                </p>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* ========== COMMITMENT SECTION ========== */}
        <div className="px-4 md:px-8 mt-2 pb-4">
          <div className="rp-gold-line mb-10" />

          {/* Deal Timeline Countdowns */}
          <div className="bg-white rounded-xl p-8 rp-card-shadow border border-[#EEF0F4] mb-6">
            <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[2px] mb-7">{t('dealTimeline')}</div>
            <div className="flex justify-around items-center">
              <CountdownRing label={t('dueDiligence')} targetDate={deal.dd_deadline} accentColor="#0E3470" />
              <CountdownRing label={t('closing')} targetDate={deal.close_deadline} accentColor="#BC9C45" />
              {deal.extension_deadline && (
                <CountdownRing label={t('extension')} targetDate={deal.extension_deadline} accentColor="#6B7280" />
              )}
            </div>
            {deal.timeline_note && (
              <div className="mt-6 px-4 py-3 bg-[#FDF8ED] border-l-[3px] border-[#BC9C45] rounded-md text-[13px] text-[#6B7280] leading-[1.6]">
                <span className="font-bold text-[#BC9C45] mr-2 tracking-[1px]">
                  ℹ {t('timelineNoteLabel')}
                </span>
                {deal.timeline_note}
              </div>
            )}
          </div>

          {/* Lock Deal */}
          <CommitmentCard deal={deal} previewMode={previewMode} />

          {/* How We Source Deals */}
          <div className="bg-white rounded-xl p-8 rp-card-shadow border border-[#EEF0F4] mb-6">
            <h3 className="font-[family-name:var(--font-playfair)] text-[20px] font-semibold text-[#0E3470] mb-5">
              {t('howWeSourceDeals')}
            </h3>
            <div className="text-[14px] text-[#4B5563] leading-[1.9] space-y-4">
              <p>{t('howWeSourceP1')}</p>
              <p>{t('howWeSourceP2')}</p>
              <p>{t('howWeSourceP3')}</p>
            </div>
          </div>

          {/* Contact Bar */}
          <div className="bg-white rounded-xl p-5 md:p-7 border border-[#EEF0F4] rp-card-shadow flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-[14px] font-medium text-[#0E3470]">{t('questionsBeforeCommitting')}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-1">
                {contactName || t('reprimeTeam')}{contactTitle ? ` · ${contactTitle}` : ''}
              </div>
            </div>
            <div className="flex gap-3">
              <a
                href={`https://wa.me/19177030365?text=Hi, I'm interested in ${deal.name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-[#25D366] text-white text-[12px] font-semibold transition-opacity hover:opacity-90"
              >
                💬 {t('whatsApp')}
              </a>
              <button
                onClick={() => {
                  setActiveTab('schedule');
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      const el = tabBarRef.current;
                      if (el) {
                        const rect = el.getBoundingClientRect();
                        const offset = window.scrollY + rect.top - 80;
                        window.scrollTo({ top: offset, behavior: 'smooth' });
                      }
                    });
                  });
                }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-lg border border-[#EEF0F4] text-[#6B7280] text-[12px] font-medium hover:border-[#BC9C45] hover:text-[#0E3470] transition-colors"
              >
                📅 {t('scheduleACall')}
              </button>
            </div>
          </div>
        </div>

        {/* -- Confidentiality Footer -- */}
        <div className="px-4 md:px-8 pb-8 md:pb-10 pt-4">
          <div className="border-t border-[#EEF0F4] pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded flex items-center justify-center">
                <span className="text-white text-[8px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
              </div>
              <span className="text-[10px] text-[#9CA3AF] tracking-wide">
                {t('reprimeterminal')}
              </span>
            </div>
            <p className="text-[10px] text-[#9CA3AF] max-w-[600px] text-right leading-relaxed">
              {t('footerConfidential')}
            </p>
          </div>
        </div>
      </div>

      {showExpressModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-8 animate-fade-up" style={{ animationDuration: '0.3s' }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#FDF8ED] flex items-center justify-center mb-4">
                <span className="text-2xl">&#x1F4BC;</span>
              </div>
              <h3 className="font-[family-name:var(--font-playfair)] text-[18px] font-semibold text-[#0E3470] mb-2">
                {t('expressInterestIn', { name: deal.name })}
              </h3>
              <p className="text-[13px] text-[#4B5563] mb-6">
                {t('expressInterestDesc')}
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setShowExpressModal(false)}
                  className="flex-1 py-2.5 text-[13px] font-medium text-[#6B7280] hover:text-[#0E3470] transition-colors"
                >
                  {tcom('cancel')}
                </button>
                <button
                  onClick={handleExpressInterest}
                  disabled={expressingInterest || previewMode}
                  title={previewMode ? 'Preview mode — read-only' : undefined}
                  className="flex-1 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {expressingInterest && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {expressingInterest ? t('processing') : tcom('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NDA Modal ── */}
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

      {/* ── Enhanced Document Viewer Modal ── */}
      {viewerUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-stretch md:items-center justify-center bg-black/80 backdrop-blur-md md:p-4"
          onClick={() => setViewerUrl(null)}
        >
          <div
            className="relative bg-white md:rounded-2xl overflow-hidden flex flex-col w-full h-full md:w-[85vw] md:h-[90vh] md:max-w-[1100px]"
            style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with gold border */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 shrink-0 gap-3" style={{ background: 'linear-gradient(135deg, #0E3470, #0a2450)', borderBottom: '2px solid #BC9C45' }}>
              <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#BC9C45]/15 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white text-[13px] md:text-[14px] font-semibold truncate">{viewerName}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewerUrl(null)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Document content with security overlay */}
            <div className="flex-1 relative" style={{ background: '#1a1a2e' }}>
              {/* Scanline effect */}
              <div className="absolute inset-0 pointer-events-none z-10" style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.006) 2px, rgba(255,255,255,0.006) 4px)',
              }} />

              {/* Watermark overlay */}
              <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="absolute whitespace-nowrap select-none"
                    style={{
                      top: `${i * 20}%`,
                      left: '50%',
                      transform: 'translateX(-50%) rotate(-22deg)',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: `rgba(188,156,69,${0.04 + (i % 2) * 0.02})`,
                      letterSpacing: '3px',
                      textTransform: 'uppercase',
                    }}
                  >
                    CONFIDENTIAL · {investorName} · {investorEmail}
                  </div>
                ))}
              </div>

              <iframe
                src={viewerUrl}
                className="w-full h-full border-0 relative z-0"
                title={viewerName}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-[#EEF0F4] shrink-0">
              <div className="text-[11px] text-[#9CA3AF]">
                {t('viewedBy')} <span className="font-semibold text-[#0E3470]">{investorName}</span> · {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
