'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatPrice, formatPriceCompact, formatPercent, formatDSCR, formatSqFt, formatNumber } from '@/lib/utils/format';
import { useCountdown } from '@/lib/hooks/useCountdown';
import { useActivityTracker } from '@/lib/hooks/useActivityTracker';
import { calculateCustomIRR } from '@/lib/utils/irr-calculator';
import { createClient } from '@/lib/supabase/client';
import FadeInOnScroll from '@/components/ui/FadeInOnScroll';
import type {
  DealWithDetails,
  TerminalDDFolder,
  TerminalDDDocument,
  TerminalAvailabilitySlot,
} from '@/lib/types/database';

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
}

type TabKey = 'overview' | 'due-diligence' | 'deal-structure' | 'schedule';
type CalculatorMode = 'assignment' | 'gplp' | 'custom';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

  const size = 130;
  const strokeWidth = 6;
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
            className="text-[28px] font-[800] leading-none"
            style={{ color: ringColor }}
          >
            {isExpired ? '00' : days}
          </span>
          <span className="text-[9px] font-[700] uppercase tracking-[2px] text-[#9CA3AF] mt-0.5">
            DAYS
          </span>
          <span className="text-[13px] text-[#9CA3AF] mt-1 font-mono">
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
        <span className="text-[10px] uppercase font-[700] tracking-[2px] text-[#9CA3AF]">
          {label}
        </span>
      </div>
      {isUrgent && !isExpired && (
        <span className="bg-[#DC2626] text-white text-[9px] px-2 py-0.5 rounded-full font-semibold mt-1.5">
          URGENT
        </span>
      )}
    </div>
  );
}

/* ---------- Image Carousel ---------- */

function ImageCarousel({ urls }: { urls: string[] }) {
  const [current, setCurrent] = useState(0);

  if (urls.length === 0) {
    return (
      <div className="w-full h-full min-h-[340px] rounded-2xl overflow-hidden relative">
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

  const goNext = () => setCurrent((p) => (p + 1) % urls.length);
  const goPrev = () => setCurrent((p) => (p - 1 + urls.length) % urls.length);

  return (
    <div className="relative w-full h-full min-h-[340px] rounded-2xl overflow-hidden group">
      <img
        src={urls[current]}
        alt={`Property photo ${current + 1}`}
        className="w-full h-full object-cover"
      />
      {urls.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-[42px] h-[42px] bg-white/90 hover:bg-white shadow-lg text-[#0E3470] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 w-[42px] h-[42px] bg-white/90 hover:bg-white shadow-lg text-[#0E3470] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
                onClick={() => setCurrent(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  idx === current ? 'bg-[#BC9C45]' : 'bg-white/50'
                }`}
                aria-label={`Go to photo ${idx + 1}`}
              />
            ))}
          </div>
          {/* Slide counter badge */}
          <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
            {current + 1}/{urls.length}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Metric Card ---------- */

function MetricCard({
  label,
  value,
  borderColor,
  valueColor,
}: {
  label: string;
  value: string | null;
  borderColor: string;
  valueColor?: string;
}) {
  return (
    <div
      className="bg-white rounded-xl p-3.5 border border-[#EEF0F4] rp-card-shadow"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <div className="data-label mb-1">
        {label}
      </div>
      <div
        className="text-[18px] font-bold"
        style={{ color: valueColor ?? '#0E3470' }}
      >
        {value ?? '--'}
      </div>
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

/* ---------- DD Folder Card ---------- */

function DDFolderCard({
  folder,
  dealId,
  onDocumentDownload,
}: {
  folder: TerminalDDFolder & { documents: TerminalDDDocument[] };
  dealId: string;
  onDocumentDownload: (docId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const docCount = folder.documents.length;
  const verifiedCount = folder.documents.filter((d) => d.is_verified).length;

  const iconBg =
    verifiedCount === docCount && docCount > 0
      ? 'bg-[#ECFDF5]'
      : verifiedCount > 0
        ? 'bg-[#FDF8ED]'
        : 'bg-[#F7F8FA]';

  return (
    <div className="bg-white rounded-xl border border-[#EEF0F4] overflow-hidden cursor-pointer hover:border-[#BC9C45] transition-colors rp-card-shadow">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center text-lg`}>
          {folder.icon ?? '\uD83D\uDCC1'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-[#0E3470] truncate">
            {folder.name}
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            {docCount} document{docCount !== 1 ? 's' : ''} &middot;{' '}
            {verifiedCount} verified
          </div>
        </div>
        <div className="flex items-center gap-2">
          {verifiedCount === docCount && docCount > 0 && (
            <div className="w-5 h-5 rounded-full bg-[#ECFDF5] flex items-center justify-center">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="#0B8A4D"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8l4 4 6-7" />
              </svg>
            </div>
          )}
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
                  {doc.file_size ?? 'Unknown size'}
                </div>
              </div>
              {doc.is_verified ? (
                <span className="bg-[#ECFDF5] text-[#0B8A4D] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Verified
                </span>
              ) : (
                <span className="bg-[#FFFBEB] text-[#D97706] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Pending
                </span>
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
              Documents pending upload
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
  onSliderChange,
}: {
  deal: DealWithDetails;
  onSliderChange: () => void;
}) {
  const [mode, setMode] = useState<CalculatorMode>('assignment');
  const [lpSplit, setLpSplit] = useState(80);
  const [prefReturn, setPrefReturn] = useState(8);
  const [acqFee, setAcqFee] = useState(1);

  const customIRR = useMemo(() => {
    const baseIRR = parseFloat(deal.gplp_irr ?? '0');
    return calculateCustomIRR(baseIRR, { lpSplit, prefReturn, acqFee });
  }, [deal.gplp_irr, lpSplit, prefReturn, acqFee]);

  const handleSliderChange = (
    setter: (v: number) => void,
    value: number
  ) => {
    setter(value);
    onSliderChange();
  };

  const modes: { key: CalculatorMode; label: string }[] = [
    { key: 'assignment', label: 'Assignment' },
    { key: 'gplp', label: 'GP/LP' },
    { key: 'custom', label: 'Custom Terms' },
  ];

  return (
    <div className="bg-[#0E3470] rounded-2xl p-6 text-white rp-card-shadow">
      <div className="data-label !text-[#BC9C45] !tracking-[2px] mb-4">
        RETURNS CALCULATOR
      </div>

      {/* Mode tabs */}
      <div className="inline-flex rounded-lg bg-white/10 p-1 mb-6">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === m.key
                ? 'bg-[#BC9C45] text-white'
                : 'text-white/60 hover:text-white'
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
            <div className="text-white/60 text-xs mb-1">Assignment Fee</div>
            <div className="text-xl font-bold">{deal.assignment_fee}</div>
          </div>
          <div className="mb-4">
            <div className="text-white/60 text-xs mb-1">Projected IRR</div>
            <div className="text-[52px] font-[800] text-[#34D399] leading-none">
              {deal.assignment_irr ?? '--'}
            </div>
          </div>
          <div className="text-xs text-white/60 mt-2">
            Fee breakdown included in projected returns
          </div>
        </div>
      )}

      {/* GP/LP Mode */}
      {mode === 'gplp' && (
        <div>
          <div className="space-y-2 mb-4">
            {[
              { label: 'Acquisition Fee', value: deal.acq_fee },
              { label: 'Asset Mgmt Fee', value: deal.asset_mgmt_fee },
              { label: 'GP Carry', value: deal.gp_carry },
              { label: 'Equity Required', value: formatPrice(deal.equity_required) },
            ].map((row) => (
              <div
                key={row.label}
                className="flex justify-between text-sm"
              >
                <span className="text-white/60">{row.label}</span>
                <span className="font-semibold">{row.value ?? '--'}</span>
              </div>
            ))}
          </div>
          <div className="mb-4">
            <div className="text-white/60 text-xs mb-1">Projected IRR</div>
            <div className="text-[52px] font-[800] text-[#34D399] leading-none">
              {deal.gplp_irr ?? '--'}
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
                <span className="text-white/60">LP Split</span>
                <span className="font-semibold">{lpSplit}%</span>
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
              <div className="flex justify-between text-[10px] text-white/40 mt-1">
                <span>50%</span>
                <span>95%</span>
              </div>
            </div>

            {/* Preferred Return slider */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-white/60">Preferred Return</span>
                <span className="font-semibold">{prefReturn}%</span>
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
              <div className="flex justify-between text-[10px] text-white/40 mt-1">
                <span>5%</span>
                <span>12%</span>
              </div>
            </div>

            {/* Acquisition Fee slider */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-white/60">Acquisition Fee</span>
                <span className="font-semibold">{acqFee}%</span>
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
              <div className="flex justify-between text-[10px] text-white/40 mt-1">
                <span>0%</span>
                <span>3%</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-white/60 text-xs mb-1">Calculated IRR</div>
            <div className="text-[52px] font-[800] text-[#34D399] leading-none">
              {customIRR.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40">
        All fees included in projected IRR
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
}: {
  dealId: string;
  slots: TerminalAvailabilitySlot[];
  bookedTimes: string[];
  onMeetingRequested: () => void;
}) {
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
          const dateObj = new Date(day);
          dateObj.setHours(h, min, 0, 0);
          const iso = dateObj.toISOString();

          // Skip if already booked
          const isBooked = bookedTimes.some((bt) => {
            const bookedDate = new Date(bt);
            return Math.abs(bookedDate.getTime() - dateObj.getTime()) < 60000;
          });

          if (!isBooked) {
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
            const displayMin = String(min).padStart(2, '0');
            result.push({
              label: `${displayH}:${displayMin} ${ampm}`,
              isoString: iso,
            });
          }
        }
      }

      return result;
    },
    [slotsByDay, bookedTimes]
  );

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setConfirming(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('terminal_meetings').insert({
        deal_id: dealId,
        investor_id: user.id,
        scheduled_at: selectedSlot,
        status: 'scheduled',
      });

      onMeetingRequested();
      setSuccess(true);
      setSelectedSlot(null);
    } finally {
      setConfirming(false);
    }
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
          Meeting Scheduled!
        </h4>
        <p className="text-sm text-[#6B7280]">
          You will receive a confirmation email shortly with meeting details.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* 2-column grid of meeting slot buttons */}
      <div className="grid grid-cols-2 gap-2">
        {weekDays.map((day) => {
          const timeSlots = generateTimeSlots(day);
          return timeSlots.map((ts) => {
            const dayLabel = dayLabels[day.getDay()];
            const dateNum = day.getDate();
            return (
              <button
                key={ts.isoString}
                onClick={() => setSelectedSlot(ts.isoString)}
                className={`text-sm px-4 py-3 rounded-lg transition-colors font-medium text-left ${
                  selectedSlot === ts.isoString
                    ? 'border border-[#BC9C45] bg-[#FDF8ED] ring-1 ring-[#BC9C45] text-[#0E3470]'
                    : 'bg-white border border-[#EEF0F4] hover:border-[#BC9C45] text-[#374151]'
                }`}
              >
                <div className="text-[10px] text-[#9CA3AF] font-medium uppercase">{dayLabel} {dateNum}</div>
                <div className="text-sm font-semibold text-[#0E3470]">{ts.label}</div>
              </button>
            );
          });
        })}
      </div>

      {selectedSlot && (
        <div className="mt-4">
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full py-3 bg-[#BC9C45] hover:bg-[#A88A3D] text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {confirming ? 'Scheduling...' : 'Confirm Meeting'}
          </button>
        </div>
      )}

      <div className="mt-3 text-center">
        <span className="text-xs text-[#9CA3AF]">
          None of these work?{' '}
          <a
            href={`mailto:?subject=Meeting%20Request`}
            className="text-[#BC9C45] hover:underline"
          >
            Email us
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
}: DealDetailClientProps) {
  const t = useTranslations('portal');
  const router = useRouter();
  const { trackActivity } = useActivityTracker();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedStructure, setSelectedStructure] = useState<'assignment' | 'gplp'>('assignment');
  const [expressedInterest, setExpressedInterest] = useState(false);
  const [showExpressModal, setShowExpressModal] = useState(false);
  const [checkingInterest, setCheckingInterest] = useState(true);

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
  };

  // DD progress calculation
  const totalDocs = deal.dd_folders.reduce(
    (sum, f) => sum + f.documents.length,
    0
  );
  const verifiedDocs = deal.dd_folders.reduce(
    (sum, f) => sum + f.documents.filter((d) => d.is_verified).length,
    0
  );
  // DD progress: use pipeline progress if available, else fall back to document verification
  const docBasedProgress = totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0;
  const ddProgress = (typeof pipelineProgress === 'number' && pipelineProgress >= 0) ? pipelineProgress : docBasedProgress;

  // Contact initials
  const initials = contactName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Notification preferences (localStorage)
  const [notifPrefs, setNotifPrefs] = useState({
    deadline: true,
    documents: true,
    meetings: true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rp_notif_prefs');
      if (saved) setNotifPrefs(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  const toggleNotifPref = (key: keyof typeof notifPrefs) => {
    setNotifPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('rp_notif_prefs', JSON.stringify(updated));
      return updated;
    });
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: t('dealDetail.overview') },
    { key: 'due-diligence', label: t('dealDetail.dueDiligence') },
    { key: 'deal-structure', label: t('dealDetail.dealStructure') },
    { key: 'schedule', label: t('dealDetail.scheduleContact') },
  ];

  // Social proof visibility
  const showSocialProof = (deal.viewing_count ?? 0) > 0 || (deal.meetings_count ?? 0) > 0;

  return (
    <div className="min-h-screen rp-page-texture font-[family-name:var(--font-poppins)]">
      {/* ------------------------------------------------------------------ */}
      {/* HERO GRADIENT BANNER                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="h-[3px] bg-gradient-to-r from-[#BC9C45] via-[#D4B96A] to-[#BC9C45]" />

      {/* ------------------------------------------------------------------ */}
      {/* 5A. STICKY TOP NAV BAR                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#EEF0F4] shadow-[0_1px_3px_rgba(14,52,112,0.04),0_4px_12px_rgba(14,52,112,0.02)]">
        <div className="h-[64px] flex items-center px-8">
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
          <div className="h-5 w-px bg-[#EEF0F4] mr-4" />
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-playfair)] text-[18px] font-semibold text-[#0E3470] truncate">
              {deal.name}
            </h1>
            <p className="text-[10px] text-[#9CA3AF] truncate">
              {deal.city}, {deal.state} &middot; {deal.property_type}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            {/* Express Interest button */}
            {expressedInterest ? (
              <span className="px-5 py-2 bg-[#ECFDF5] text-[#0B8A4D] text-[12px] font-semibold rounded-lg flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#0B8A4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4 4 6-7"/></svg>
                Interest Expressed
              </span>
            ) : (
              <button
                onClick={() => setShowExpressModal(true)}
                disabled={checkingInterest}
                className="px-5 py-2 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[12px] font-semibold rounded-lg transition-colors shadow-[0_2px_6px_rgba(188,156,69,0.25)] disabled:opacity-50"
              >
                Express Interest
              </button>
            )}
            {/* Download OM button */}
            <a
              href={`/api/deals/${deal.id}/package`}
              className="px-4 py-2 border border-[#EEF0F4] hover:border-[#BC9C45] text-[#6B7280] hover:text-[#0E3470] text-[12px] font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download OM
            </a>
            <div className="h-4 w-px bg-[#EEF0F4]" />
            <span className="text-[9px] font-semibold tracking-[2px] uppercase text-[#9CA3AF]">
              CONFIDENTIAL
            </span>
            <div className="h-4 w-px bg-[#EEF0F4]" />
            <div className="w-8 h-8 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded-lg flex items-center justify-center shadow-[0_2px_6px_rgba(188,156,69,0.2)]">
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
        <div className="rp-dark-gradient px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-playfair)] text-[28px] font-semibold text-white leading-tight tracking-[-0.01em]">
                {deal.name}
              </h2>
              <p className="text-[12px] text-white/40 mt-1">
                {deal.city}, {deal.state} &middot; {deal.property_type}
                {deal.square_footage ? ` \u00B7 ${deal.square_footage} SF` : ''}
                {deal.units ? ` \u00B7 ${deal.units} Units` : ''}
                {deal.class_type ? ` \u00B7 Class ${deal.class_type}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {deal.seller_financing && (
                <span className="bg-[#BC9C45] text-white text-[10px] font-semibold px-3 py-1.5 rounded-full">
                  Seller Financing
                </span>
              )}
              <span className="bg-white/5 border border-white/10 text-white/50 text-[10px] font-semibold px-3 py-1.5 rounded-full">
                {deal.property_type}
              </span>
            </div>
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-transparent via-[#BC9C45]/50 to-transparent" />

        {/* ------------------------------------------------------------------ */}
        {/* 2. HERO SECTION                                                    */}
        {/* ------------------------------------------------------------------ */}
        <div className="grid grid-cols-[1.4fr_1fr] gap-6 p-8">
          {/* Left: Image Carousel */}
          <ImageCarousel urls={photoUrls} />

          {/* Right: 5B Circular Countdown Rings */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-[#EEF0F4] p-6 rp-card-shadow">
              <div className="flex items-center justify-around">
                <CountdownRing
                  label="Due Diligence"
                  targetDate={deal.dd_deadline}
                  accentColor="#BC9C45"
                />
                <CountdownRing
                  label="Closing"
                  targetDate={deal.close_deadline}
                  accentColor="#0E3470"
                />
                <CountdownRing
                  label="Extension"
                  targetDate={deal.extension_deadline}
                  accentColor="#1D5FB8"
                />
              </div>
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* 5C. TERMINAL INTELLIGENCE PANEL                                    */}
            {/* ------------------------------------------------------------------ */}
            {deal.acquisition_thesis && (
              <div className="bg-[#0E3470] rounded-xl p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-[#BC9C45]/15 flex items-center justify-center">
                    <span className="text-[#BC9C45] text-lg">{'\u26A1'}</span>
                  </div>
                  <div>
                    <div className="text-[12px] font-[700] uppercase tracking-[2px] text-[#BC9C45]">
                      TERMINAL INTELLIGENCE
                    </div>
                    <div className="text-[9px] text-white/50">
                      Institutional analysis by RePrime research team
                    </div>
                  </div>
                </div>
                {/* Body */}
                <p className="text-[13px] text-white/80 leading-[1.7] font-[300]">
                  {deal.acquisition_thesis}
                </p>
                {/* Footer buttons */}
                <div className="flex items-center gap-3 mt-5">
                  <button className="px-4 py-2 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[11px] font-semibold rounded-lg transition-colors">
                    Full Report
                  </button>
                  <button className="px-4 py-2 border border-white/20 hover:border-white/40 text-white text-[11px] font-semibold rounded-lg transition-colors">
                    Comparable Analysis
                  </button>
                  <button className="px-4 py-2 border border-white/20 hover:border-white/40 text-white text-[11px] font-semibold rounded-lg transition-colors">
                    Risk Assessment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 5D. SEVEN-METRIC BAR (left border metric cards - keep as is)       */}
        {/* ------------------------------------------------------------------ */}
        <div className="grid grid-cols-7 gap-3 px-8 mt-8">
          {[
            { label: 'Purchase Price', value: formatPrice(deal.purchase_price), borderColor: '#0E3470' },
            { label: 'NOI', value: formatPrice(deal.noi), borderColor: '#0E3470' },
            { label: 'Cap Rate', value: formatPercent(deal.cap_rate), borderColor: '#BC9C45' },
            { label: 'IRR', value: formatPercent(deal.irr), borderColor: '#0B8A4D', valueColor: '#0B8A4D' },
            { label: 'CoC', value: formatPercent(deal.coc), borderColor: '#0B8A4D', valueColor: '#0B8A4D' },
            { label: 'DSCR', value: formatDSCR(deal.dscr), borderColor: '#0E3470' },
            { label: 'Equity', value: formatPrice(deal.equity_required), borderColor: '#BC9C45' },
          ].map((m, idx) => (
            <FadeInOnScroll key={m.label} delay={idx * 0.05}>
              <MetricCard
                label={m.label}
                value={m.value}
                borderColor={m.borderColor}
                valueColor={m.valueColor}
              />
            </FadeInOnScroll>
          ))}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 5E. TAB BAR                                                        */}
        {/* ------------------------------------------------------------------ */}
        <div className="px-8 mt-8">
          <div className="bg-[#F7F8FA] rounded-lg p-1 inline-flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-7 py-3 text-[12px] font-[600] tracking-[0.5px] transition-all ${
                  activeTab === tab.key
                    ? 'bg-[#0E3470] text-white'
                    : 'bg-transparent text-[#9CA3AF] hover:bg-white hover:text-[#0E3470]'
                }`}
              >
                {tab.label}
              </button>
            ))}
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
          <div className="grid grid-cols-[1fr_360px] gap-8 mt-8 px-8 pb-10">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Investment Highlights - 2-column grid of mini cards */}
              {deal.investment_highlights &&
                deal.investment_highlights.length > 0 && (
                  <FadeInOnScroll delay={0}>
                    <div>
                      <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-4">
                        Investment Highlights
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
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
                      Acquisition Thesis
                    </h3>
                    <p className="text-sm text-[#4B5563] leading-[1.8]">
                      {deal.acquisition_thesis}
                    </p>
                  </div>
                </FadeInOnScroll>
              )}

              {/* Financing Summary */}
              <FadeInOnScroll delay={0.2}>
                <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
                  <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-4">
                    Financing Summary
                  </h3>
                  <div className="space-y-0">
                    {[
                      { label: 'Loan Estimate', value: formatPrice(deal.loan_estimate), color: '' },
                      {
                        label: 'Seller Financing',
                        value: deal.seller_financing ? 'Yes' : 'No',
                        color: deal.seller_financing ? 'text-[#0B8A4D]' : 'text-[#9CA3AF]',
                      },
                      { label: 'Loan Fee', value: deal.loan_fee, color: '' },
                      { label: 'Equity Required', value: formatPrice(deal.equity_required), color: '' },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex justify-between py-2.5 border-b border-[#EEF0F4] last:border-b-0"
                      >
                        <span className="data-label">
                          {row.label}
                        </span>
                        <span className={`text-sm font-semibold ${row.color || 'text-[#0E3470]'}`}>
                          {row.value ?? '--'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {deal.special_terms && deal.special_terms !== 'None' && (
                    <div className="mt-4 bg-[#FDF8ED] border-l-4 border-[#BC9C45] p-4 rounded-r-lg">
                      <div className="text-[11px] font-semibold text-[#BC9C45] uppercase tracking-wider mb-1">
                        Special Terms
                      </div>
                      <p className="text-sm text-[#4B5563]">
                        {deal.special_terms}
                      </p>
                    </div>
                  )}
                </div>
              </FadeInOnScroll>

              {/* Market Context - with emoji icons */}
              <FadeInOnScroll delay={0.3}>
                <div>
                  <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-[#0E3470] mb-4">
                    Market Context
                  </h3>
                  <div className="flex gap-4">
                    <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 flex-1 rp-card-shadow">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base">{'\uD83D\uDC65'}</span>
                        <span className="data-label">Metro Population</span>
                      </div>
                      <div className="text-lg font-bold text-[#0E3470]">
                        {formatNumber(deal.metro_population)}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 flex-1 rp-card-shadow">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base">{'\uD83D\uDCC8'}</span>
                        <span className="data-label">Job Growth</span>
                      </div>
                      <div className="text-lg font-bold text-[#0B8A4D]">
                        {deal.job_growth ? `+${deal.job_growth}` : '--'}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 flex-1 rp-card-shadow">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base">{'\uD83C\uDFE2'}</span>
                        <span className="data-label">Occupancy</span>
                      </div>
                      <div className="text-lg font-bold text-[#0E3470]">
                        {deal.occupancy ? `${deal.occupancy}%` : '--'}
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInOnScroll>

              {/* Cycle Indicator - with Howard Marks Framework label */}
              <FadeInOnScroll delay={0.3}>
                <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 mt-4 rp-card-shadow">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-[#0E3470]">
                      Market Cycle Position
                    </h3>
                    <span className="text-[9px] text-[#9CA3AF]">Howard Marks Framework</span>
                  </div>
                  <div className="relative mt-3">
                    <div className="h-3 rounded-full bg-gradient-to-r from-[#0B8A4D] via-[#BC9C45] to-[#DC2626]" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2"
                      style={{ left: '35%', transform: 'translateX(-50%) translateY(-50%)' }}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] font-bold text-[#BC9C45] mb-1">
                          WE ARE HERE
                        </span>
                        <div className="w-5 h-5 bg-[#BC9C45] border-2 border-white rounded-full shadow-md" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between mt-3 text-[9px] text-[#9CA3AF] uppercase tracking-wider">
                    <span>Recovery</span>
                    <span>Expansion</span>
                    <span>Peak</span>
                  </div>
                </div>
              </FadeInOnScroll>
            </div>

            {/* Right Column (Sidebar) */}
            <div className="space-y-4">
              {/* Property Details */}
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 rp-card-shadow">
                <h3 className="text-sm font-semibold text-[#0E3470] mb-4">
                  Property Details
                </h3>
                <div className="space-y-0">
                  {[
                    { label: 'Type', value: deal.property_type },
                    { label: 'Class', value: deal.class_type },
                    { label: 'Year Built', value: deal.year_built?.toString() },
                    { label: 'Sq Ft', value: formatSqFt(deal.square_footage) },
                    { label: 'Units', value: deal.units },
                    { label: 'Neighborhood', value: deal.neighborhood },
                  ].map((row, idx) => (
                    <div
                      key={row.label}
                      className={`flex justify-between py-2.5 ${
                        idx % 2 === 0 ? 'bg-[#F7F8FA]' : ''
                      } px-2 rounded`}
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
              </div>

              {/* Cap Rate Sparkline */}
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
                <h4 className="text-sm font-semibold text-[#0E3470] mb-3">
                  Cap Rate Trend
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

              {/* Live Activity Feed - colored dots per type + stagger animation */}
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 rp-card-shadow">
                <h4 className="text-sm font-semibold text-[#0E3470] mb-3">
                  Recent Activity
                </h4>
                <div className="space-y-3">
                  {[
                    { dot: 'bg-[#6B7280]', text: 'Terminal member viewed this deal', time: '2 min ago', type: 'view' },
                    { dot: 'bg-[#1D5FB8]', text: 'Document downloaded', time: '15 min ago', type: 'docs' },
                    { dot: 'bg-[#BC9C45]', text: 'Meeting scheduled', time: '1 hour ago', type: 'meeting' },
                    { dot: 'bg-[#0B8A4D]', text: 'Verification completed', time: '3 hours ago', type: 'verification' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 animate-slide-in"
                      style={{ animationDelay: `${idx * 0.1}s` }}
                    >
                      <div className={`w-2 h-2 rounded-full ${item.dot} mt-1.5 shrink-0`} />
                      <div>
                        <div className="text-xs text-[#374151]">{item.text}</div>
                        <div className="text-xs text-[#6B7280]">{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Proof -- hidden when both counts are 0 */}
              {showSocialProof && (
                <div className="bg-[#FEF2F2] rounded-xl p-4 border border-[#FECACA]">
                  <div className="text-center">
                    <div className="text-[32px] font-[800] text-[#DC2626]">
                      {deal.viewing_count}
                    </div>
                    <div className="text-xs text-[#6B7280] mb-2">investors reviewing</div>
                    <div className="text-[32px] font-[800] text-[#DC2626]">
                      {deal.meetings_count}
                    </div>
                    <div className="text-xs text-[#6B7280]">meetings scheduled</div>
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
          <div className="mt-8 px-8 pb-10">
            {/* Progress bar + Download button row */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1 mr-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="data-label !text-[#0B8A4D]">
                    DD COMPLETION
                  </span>
                  <span className="text-sm font-semibold text-[#0B8A4D]">
                    {ddProgress}%
                  </span>
                </div>
                <div className="bg-[#EEF0F4] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#0B8A4D] to-[#34D399] h-full rounded-full transition-all duration-500"
                    style={{ width: `${ddProgress}%` }}
                  />
                </div>
                <div className="text-[11px] text-[#9CA3AF] mt-1">
                  {verifiedDocs} of {totalDocs} verified
                </div>
              </div>
              <a
                href={`/api/deals/${deal.id}/package`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
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
                Download Complete Package
              </a>
            </div>

            {/* Folder Grid */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              {deal.dd_folders.map((folder, idx) => (
                <FadeInOnScroll key={folder.id} delay={idx * 0.05}>
                  <DDFolderCard
                    folder={folder}
                    dealId={deal.id}
                    onDocumentDownload={handleDocumentDownload}
                  />
                </FadeInOnScroll>
              ))}
              {deal.dd_folders.length === 0 && (
                <div className="col-span-2 bg-white rounded-xl border border-[#EEF0F4] p-12 text-center">
                  <span className="text-3xl block mb-3">{'\u231B'}</span>
                  <p className="text-sm text-[#9CA3AF]">
                    Documents pending upload
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== 5H. DEAL STRUCTURE TAB ========== */}
        <div
          className="transition-opacity duration-200"
          style={{ display: activeTab === 'deal-structure' ? 'block' : 'none' }}
        >
          <div className="mt-8 px-8 pb-10">
            {/* Two option cards side by side */}
            <div className="grid grid-cols-2 gap-6">
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
                      OPTION A
                    </span>
                    {/* Assignment fee large number top-right */}
                    <span className="text-[32px] font-[800] text-[#BC9C45] leading-none">
                      {deal.assignment_fee ?? '3%'}
                    </span>
                  </div>
                  <h3 className="font-[700] text-[#0E3470] text-[20px] mb-4">
                    Assignment
                  </h3>
                  <p className="text-sm text-[#6B7280] mb-4">
                    Clean assignment of contract with fixed fee. All projected
                    returns account for the assignment fee.
                  </p>
                  <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
                    <div className="data-label !text-[#0B8A4D] mb-1">
                      Projected IRR
                    </div>
                    <div className="text-2xl font-bold text-[#0B8A4D]">
                      {deal.assignment_irr ?? '--'}
                    </div>
                    <div className="text-[11px] text-[#6B7280] mt-1">
                      Fee included
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
                    OPTION B
                  </span>
                  <h3 className="font-[700] text-[#0E3470] text-[20px] mb-4">
                    GP/LP Partnership
                  </h3>
                  <div className="space-y-2 mb-4">
                    {[
                      { label: 'Acquisition Fee', value: deal.acq_fee },
                      { label: 'Asset Mgmt Fee', value: deal.asset_mgmt_fee },
                      { label: 'GP Carry', value: deal.gp_carry },
                      { label: 'Equity Required', value: formatPrice(deal.equity_required) },
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
                      Projected IRR
                    </div>
                    <div className="text-2xl font-bold text-[#0B8A4D]">
                      {deal.gplp_irr ?? '--'}
                    </div>
                    <div className="text-[11px] text-[#6B7280] mt-1">
                      All fees included
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
                  onSliderChange={handleIRRSliderChange}
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
          <div className="mt-8 px-8 pb-10 grid grid-cols-[1fr_1fr] gap-6">
            {/* Left: Meeting Scheduler */}
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
              <h3 className="text-sm font-semibold text-[#0E3470] mb-4">
                Schedule a Meeting
              </h3>
              <MeetingScheduler
                dealId={deal.id}
                slots={availabilitySlots}
                bookedTimes={bookedTimes}
                onMeetingRequested={handleMeetingRequested}
              />
            </div>

            {/* Right: Contact & Info */}
            <div className="space-y-4">
              {/* Contact Card with navy gradient avatar */}
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center shrink-0 shadow-lg">
                    <span className="text-white font-bold text-lg">
                      {initials || 'RP'}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-[#0E3470]">
                      {contactName || 'RePrime Team'}
                    </div>
                    <div className="text-xs text-[#9CA3AF]">
                      {contactTitle || 'Investment Advisor'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(`RE: ${deal.name}`)}`}
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
                    Email {contactName?.split(' ')[0] || 'Shirel'} About This Deal
                  </a>
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Callback Request: ${deal.name}`)}`}
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
                    Request a Call Back
                  </a>
                </div>
              </div>

              {/* Email Availability Card */}
              <div className="bg-[#FDF8ED] border border-[#BC9C45]/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#0B8A4D] live-dot" />
                  <span className="text-sm font-semibold text-[#0E3470]">Available via Email</span>
                </div>
                <p className="text-xs text-[#6B7280]">
                  Typical response time: within 2 business hours
                </p>
              </div>

              {/* Notification Preferences */}
              <div className="bg-white rounded-xl border border-[#EEF0F4] p-6 rp-card-shadow">
                <h4 className="data-label mb-3">
                  Notification Preferences
                </h4>
                <div className="space-y-2.5">
                  {(
                    [
                      { key: 'deadline' as const, label: 'New deals matching your criteria' },
                      {
                        key: 'documents' as const,
                        label: 'New document uploads',
                      },
                      {
                        key: 'meetings' as const,
                        label: 'Deal activity updates',
                      },
                    ] as const
                  ).map((pref) => (
                    <label
                      key={pref.key}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={notifPrefs[pref.key]}
                        onChange={() => toggleNotifPref(pref.key)}
                        className="w-4 h-4 rounded border-[#D1D5DB] text-[#BC9C45] focus:ring-[#BC9C45]/20"
                      />
                      <span className="text-sm text-[#4B5563]">
                        {pref.label}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-[#9CA3AF] mt-3">
                  You control your notifications
                </p>
              </div>

              {/* Limited Release Indicator */}
              <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#DC2626] countdown-pulse" />
                  <span className="text-sm font-semibold text-[#DC2626]">
                    LIMITED RELEASE
                  </span>
                </div>
                <p className="text-xs text-[#4B5563] mb-1">
                  Q{Math.ceil((new Date().getMonth() + 1) / 3)} {new Date().getFullYear()} release
                </p>
                <p className="text-xs text-[#6B7280]">
                  Controlled release to qualified Terminal members only
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* -- Confidentiality Footer -- */}
        <div className="px-8 pb-10 pt-4">
          <div className="border-t border-[#EEF0F4] pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded flex items-center justify-center">
                <span className="text-white text-[8px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
              </div>
              <span className="text-[10px] text-[#9CA3AF] tracking-wide">
                REPRIME TERMINAL
              </span>
            </div>
            <p className="text-[10px] text-[#9CA3AF] max-w-[600px] text-right leading-relaxed">
              This material is confidential and intended solely for the use of authorized Terminal members.
              Any reproduction or distribution is strictly prohibited. All investments involve risk.
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
                Express Interest in {deal.name}
              </h3>
              <p className="text-[13px] text-[#4B5563] mb-6">
                The RePrime team will contact you within 24 hours to discuss this opportunity.
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setShowExpressModal(false)}
                  className="flex-1 py-2.5 text-[13px] font-medium text-[#6B7280] hover:text-[#0E3470] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExpressInterest}
                  className="flex-1 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[13px] font-semibold rounded-lg transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
