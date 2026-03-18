'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice, formatPriceCompact, formatPercent, formatDSCR, formatSqFt, formatNumber } from '@/lib/utils/format';
import { useCountdown } from '@/lib/hooks/useCountdown';
import { useActivityTracker } from '@/lib/hooks/useActivityTracker';
import { calculateCustomIRR } from '@/lib/utils/irr-calculator';
import { createClient } from '@/lib/supabase/client';
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
}

type TabKey = 'overview' | 'due-diligence' | 'deal-structure' | 'schedule';
type CalculatorMode = 'assignment' | 'gplp' | 'custom';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/* ---------- Countdown Timer Card ---------- */

function CountdownTimerCard({
  label,
  targetDate,
}: {
  label: string;
  targetDate: string | null;
}) {
  const { days, hours, minutes, seconds, isExpired, isUrgent } =
    useCountdown(targetDate);

  const digitClass = isExpired
    ? 'bg-[#D1D5DB] text-[#9CA3AF]'
    : isUrgent
      ? 'bg-[#1C0A0A] text-[#FF4444]'
      : 'bg-[#0E3470] text-white';

  const groups: { value: number; unit: string }[] = [
    { value: days, unit: 'DAYS' },
    { value: hours, unit: 'HRS' },
    { value: minutes, unit: 'MIN' },
    { value: seconds, unit: 'SEC' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#EEF0F4] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
          {label}
        </span>
        {isUrgent && !isExpired && (
          <span className="bg-[#DC2626] text-white text-[10px] px-2.5 py-0.5 rounded-full font-semibold">
            URGENT
          </span>
        )}
        {isExpired && (
          <span className="text-[#9CA3AF] text-[10px] font-semibold uppercase">
            EXPIRED
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {groups.map((g, i) => (
          <div key={g.unit} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-[#D1D5DB] text-2xl font-bold mx-0.5">:</span>
            )}
            <div className="flex flex-col items-center">
              <div
                className={`${digitClass} rounded-lg w-[58px] h-[68px] flex items-center justify-center text-[32px] font-extrabold`}
              >
                {String(g.value).padStart(2, '0')}
              </div>
              <span className="text-[8px] text-[#9CA3AF] uppercase tracking-widest mt-1.5 font-medium">
                {g.unit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Image Carousel ---------- */

function ImageCarousel({ urls }: { urls: string[] }) {
  const [current, setCurrent] = useState(0);

  if (urls.length === 0) {
    return (
      <div className="w-full h-full min-h-[340px] rounded-2xl overflow-hidden bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center">
        <svg
          width="80"
          height="80"
          viewBox="0 0 24 24"
          fill="none"
          className="text-white/10"
        >
          <path
            d="M3 21V3h18v18H3z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M3 17l4-4 4 4 4-6 6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="7" y="7" width="4" height="4" rx="1" fill="currentColor" />
        </svg>
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
      className="bg-white rounded-xl p-3.5 border border-[#EEF0F4]"
      style={{ borderTop: `3px solid ${borderColor}` }}
    >
      <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-medium mb-1">
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
  let colorClass = 'bg-gray-100 text-gray-600';
  let label = 'FILE';

  if (ext.includes('pdf')) {
    colorClass = 'bg-red-100 text-red-600';
    label = 'PDF';
  } else if (ext.includes('sheet') || ext.includes('xlsx')) {
    colorClass = 'bg-green-100 text-green-600';
    label = 'XLSX';
  } else if (ext.includes('word') || ext.includes('docx')) {
    colorClass = 'bg-blue-100 text-blue-600';
    label = 'DOC';
  } else if (ext.includes('zip')) {
    colorClass = 'bg-blue-100 text-blue-600';
    label = 'ZIP';
  }

  return (
    <span className={`${colorClass} text-[10px] font-bold px-2 py-0.5 rounded`}>
      {label}
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
    <div className="bg-white rounded-xl border border-[#EEF0F4] overflow-hidden cursor-pointer hover:border-[#BC9C45] transition-colors">
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
              No documents in this folder yet.
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
    <div className="bg-[#0E3470] rounded-2xl p-6 text-white">
      <h3 className="font-bold text-lg mb-4">IRR Calculator</h3>

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
            <div className="text-[52px] font-extrabold text-[#BC9C45] leading-none">
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
              { label: 'Equity Required', value: deal.equity_required },
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
            <div className="text-[52px] font-extrabold text-[#BC9C45] leading-none">
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
            <div className="text-[52px] font-extrabold text-[#BC9C45] leading-none">
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
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const timeSlots = generateTimeSlots(day);
          return (
            <div key={day.toISOString()} className="min-w-0">
              <div className="text-center mb-2">
                <div className="text-[10px] text-[#9CA3AF] font-medium">
                  {dayLabels[day.getDay()]}
                </div>
                <div className="text-xs font-semibold text-[#0E3470]">
                  {day.getDate()}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {timeSlots.length === 0 && (
                  <div className="text-[9px] text-[#D1D5DB] text-center py-2">
                    --
                  </div>
                )}
                {timeSlots.map((ts) => (
                  <button
                    key={ts.isoString}
                    onClick={() => setSelectedSlot(ts.isoString)}
                    className={`text-sm px-4 py-2.5 rounded-lg transition-colors font-medium ${
                      selectedSlot === ts.isoString
                        ? 'border border-[#BC9C45] bg-[#FDF8ED] ring-1 ring-[#BC9C45] text-[#0E3470]'
                        : 'bg-white border border-[#EEF0F4] hover:border-[#BC9C45] text-[#374151]'
                    }`}
                  >
                    {ts.label}
                  </button>
                ))}
              </div>
            </div>
          );
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
}: DealDetailClientProps) {
  const router = useRouter();
  const { trackActivity } = useActivityTracker();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [selectedStructure, setSelectedStructure] = useState<'assignment' | 'gplp'>('assignment');

  // Track deal_viewed on mount
  useEffect(() => {
    trackActivity('deal_viewed', deal.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // DD progress calculation
  const totalDocs = deal.dd_folders.reduce(
    (sum, f) => sum + f.documents.length,
    0
  );
  const verifiedDocs = deal.dd_folders.reduce(
    (sum, f) => sum + f.documents.filter((d) => d.is_verified).length,
    0
  );
  const ddProgress = totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0;

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
    { key: 'overview', label: 'Overview' },
    { key: 'due-diligence', label: 'Due Diligence Room' },
    { key: 'deal-structure', label: 'Deal Structure' },
    { key: 'schedule', label: 'Schedule & Contact' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] font-[family-name:var(--font-poppins)]">
      {/* ------------------------------------------------------------------ */}
      {/* 1. STICKY TOP NAV BAR                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#EEF0F4] h-14 flex items-center px-6">
        <button
          onClick={() => router.push(`/${locale}/portal`)}
          className="hover:bg-[#F7F8FA] rounded-full p-2 transition mr-2"
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
            className="text-[#6B7280]"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-[#0E3470] truncate flex-1">
          {deal.name}
        </h1>
        <div className="w-8 h-8 rounded-lg bg-[#BC9C45] flex items-center justify-center ml-4 shrink-0">
          <span className="text-white text-xs font-bold">R</span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. HERO SECTION                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-6 p-6">
        {/* Left: Image Carousel */}
        <ImageCarousel urls={photoUrls} />

        {/* Right: Countdown Timers */}
        <div className="flex flex-col gap-4">
          <CountdownTimerCard
            label="Due Diligence Deadline"
            targetDate={deal.dd_deadline}
          />
          <CountdownTimerCard
            label="Closing Deadline"
            targetDate={deal.close_deadline}
          />
          <CountdownTimerCard
            label="Extension Deadline"
            targetDate={deal.extension_deadline}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. SEVEN-METRIC BAR                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-7 gap-3 px-6 mt-6">
        <MetricCard
          label="Purchase Price"
          value={formatPrice(deal.purchase_price)}
          borderColor="#0E3470"
        />
        <MetricCard
          label="NOI"
          value={formatPrice(deal.noi)}
          borderColor="#0E3470"
        />
        <MetricCard
          label="Cap Rate"
          value={formatPercent(deal.cap_rate)}
          borderColor="#BC9C45"
        />
        <MetricCard
          label="IRR"
          value={formatPercent(deal.irr)}
          borderColor="#0B8A4D"
          valueColor="#0B8A4D"
        />
        <MetricCard
          label="CoC"
          value={formatPercent(deal.coc)}
          borderColor="#0B8A4D"
          valueColor="#0B8A4D"
        />
        <MetricCard
          label="DSCR"
          value={formatDSCR(deal.dscr)}
          borderColor="#0E3470"
        />
        <MetricCard
          label="Equity"
          value={formatPrice(deal.equity_required)}
          borderColor="#BC9C45"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. TABS                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="px-6 mt-6">
        <div className="flex border-b border-[#EEF0F4] gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-[#0E3470] font-semibold'
                  : 'text-[#9CA3AF] hover:text-[#0E3470]'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#BC9C45] rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB CONTENT                                                        */}
      {/* ------------------------------------------------------------------ */}

      {/* ========== OVERVIEW TAB ========== */}
      <div
        className="transition-opacity duration-200"
        style={{ display: activeTab === 'overview' ? 'block' : 'none' }}
      >
        <div className="grid grid-cols-[1fr_340px] gap-6 mt-6 px-6 pb-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Investment Highlights */}
            {deal.investment_highlights &&
              deal.investment_highlights.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-[#0E3470] mb-4">
                    Investment Highlights
                  </h3>
                  <div className="space-y-3">
                    {deal.investment_highlights.map((highlight, idx) => (
                      <div key={idx} className="flex gap-3 items-start mb-3">
                        <div className="w-6 h-6 rounded-lg bg-[#ECFDF5] flex items-center justify-center shrink-0">
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
                    ))}
                  </div>
                </div>
              )}

            {/* Acquisition Thesis */}
            {deal.acquisition_thesis && (
              <div>
                <h3 className="text-lg font-bold text-[#0E3470] mb-3">
                  Acquisition Thesis
                </h3>
                <p className="text-sm text-[#4B5563] leading-[1.8]">
                  {deal.acquisition_thesis}
                </p>
              </div>
            )}

            {/* Financing Summary */}
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-5">
              <h3 className="text-sm font-semibold text-[#0E3470] mb-4">
                Financing Summary
              </h3>
              <div className="space-y-0">
                {[
                  { label: 'Loan Estimate', value: deal.loan_estimate },
                  {
                    label: 'Seller Financing',
                    value: deal.seller_financing ? 'Yes' : 'No',
                  },
                  { label: 'Loan Fee', value: deal.loan_fee },
                  { label: 'Equity Required', value: deal.equity_required },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between py-2.5 border-b border-[#EEF0F4] last:border-b-0"
                  >
                    <span className="text-xs text-[#9CA3AF]">
                      {row.label}
                    </span>
                    <span className="text-sm font-semibold text-[#0E3470]">
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

            {/* Market Context */}
            <div>
              <h3 className="text-lg font-bold text-[#0E3470] mb-4">
                Market Context
              </h3>
              <div className="flex gap-4">
                <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 flex-1">
                  <div className="text-[10px] text-[#9CA3AF] uppercase font-semibold tracking-wider mb-1">
                    Metro Population
                  </div>
                  <div className="text-lg font-bold text-[#0E3470]">
                    {formatNumber(deal.metro_population)}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 flex-1">
                  <div className="text-[10px] text-[#9CA3AF] uppercase font-semibold tracking-wider mb-1">
                    Job Growth
                  </div>
                  <div className="text-lg font-bold text-[#0B8A4D]">
                    {deal.job_growth ? `+${deal.job_growth}` : '--'}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#EEF0F4] p-4 flex-1">
                  <div className="text-[10px] text-[#9CA3AF] uppercase font-semibold tracking-wider mb-1">
                    Occupancy
                  </div>
                  <div className="text-lg font-bold text-[#0E3470]">
                    {deal.occupancy ? `${deal.occupancy}%` : '--'}
                  </div>
                </div>
              </div>
            </div>

            {/* Cycle Indicator */}
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-5 mt-4">
              <h3 className="text-sm font-semibold text-[#0E3470] mb-1">
                Market Cycle Position
              </h3>
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
          </div>

          {/* Right Column (Sidebar) */}
          <div className="space-y-4">
            {/* Property Details */}
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-5">
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
                    <span className="text-xs text-[#9CA3AF]">
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
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-4">
              <h4 className="text-sm font-semibold text-[#0E3470] mb-3">
                Cap Rate Trend
              </h4>
              <svg viewBox="0 0 200 60" className="w-full h-14">
                <polyline
                  points="0,45 30,40 60,38 90,35 120,30 150,28 180,25 200,22"
                  stroke="#0B8A4D"
                  strokeWidth="2"
                  fill="none"
                />
                <circle cx="200" cy="22" r="4" fill="#0B8A4D" />
              </svg>
            </div>

            {/* Live Activity Feed */}
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-4">
              <h4 className="text-sm font-semibold text-[#0E3470] mb-3">
                Recent Activity
              </h4>
              <div className="space-y-3">
                {[
                  { dot: 'bg-[#0B8A4D]', text: 'Terminal member viewed this deal', time: '2 min ago' },
                  { dot: 'bg-[#1D5FB8]', text: 'Document downloaded', time: '15 min ago' },
                  { dot: 'bg-[#BC9C45]', text: 'Meeting scheduled', time: '1 hour ago' },
                  { dot: 'bg-[#0B8A4D]', text: 'New member viewing', time: '3 hours ago' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.dot} mt-1.5 shrink-0`} />
                    <div>
                      <div className="text-xs text-[#374151]">{item.text}</div>
                      <div className="text-xs text-[#6B7280]">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Proof */}
            <div className="bg-[#FEF2F2] rounded-xl p-4 border border-[#FECACA]">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#0E3470]">
                  {deal.viewing_count}
                </div>
                <div className="text-xs text-[#6B7280] mb-2">investors reviewing</div>
                <div className="text-2xl font-bold text-[#0E3470]">
                  {deal.meetings_count}
                </div>
                <div className="text-xs text-[#6B7280]">meetings scheduled</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========== DUE DILIGENCE TAB ========== */}
      <div
        className="transition-opacity duration-200"
        style={{ display: activeTab === 'due-diligence' ? 'block' : 'none' }}
      >
        <div className="mt-6 px-6 pb-8">
          {/* Progress bar + Download button row */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1 mr-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[#0B8A4D]">
                  {ddProgress}% Complete
                </span>
                <span className="text-xs text-[#9CA3AF]">
                  {verifiedDocs} of {totalDocs} verified
                </span>
              </div>
              <div className="bg-[#EEF0F4] rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#0B8A4D] to-[#34D399] h-full rounded-full transition-all duration-500"
                  style={{ width: `${ddProgress}%` }}
                />
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
            {deal.dd_folders.map((folder) => (
              <DDFolderCard
                key={folder.id}
                folder={folder}
                dealId={deal.id}
                onDocumentDownload={handleDocumentDownload}
              />
            ))}
            {deal.dd_folders.length === 0 && (
              <div className="col-span-2 bg-white rounded-xl border border-[#EEF0F4] p-12 text-center">
                <p className="text-sm text-[#9CA3AF]">
                  No due diligence documents available yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== DEAL STRUCTURE TAB ========== */}
      <div
        className="transition-opacity duration-200"
        style={{ display: activeTab === 'deal-structure' ? 'block' : 'none' }}
      >
        <div className="mt-6 px-6 pb-8">
          {/* Two option cards side by side */}
          <div className="grid grid-cols-2 gap-6">
            {/* Option A: Assignment */}
            <button
              onClick={() => setSelectedStructure('assignment')}
              className={`bg-white rounded-xl border-2 p-6 text-left cursor-pointer transition-all ${
                selectedStructure === 'assignment'
                  ? 'border-[#BC9C45] shadow-[0_0_0_3px_#FDF8ED]'
                  : 'border-[#EEF0F4] hover:border-[#D1D5DB]'
              }`}
            >
              <h3 className="font-bold text-[#0E3470] text-lg mb-4">
                Option A: Assignment
              </h3>
              <div className="mb-4">
                <div className="text-xs text-[#9CA3AF] mb-1">
                  Assignment Fee
                </div>
                <div className="text-2xl font-bold text-[#0E3470]">
                  {deal.assignment_fee}
                </div>
              </div>
              <p className="text-sm text-[#6B7280] mb-4">
                Clean assignment of contract with fixed fee. All projected
                returns account for the assignment fee.
              </p>
              <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
                <div className="text-[10px] text-[#0B8A4D] uppercase font-semibold mb-1">
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

            {/* Option B: GP/LP Partnership */}
            <button
              onClick={() => setSelectedStructure('gplp')}
              className={`bg-white rounded-xl border-2 p-6 text-left cursor-pointer transition-all ${
                selectedStructure === 'gplp'
                  ? 'border-[#BC9C45] shadow-[0_0_0_3px_#FDF8ED]'
                  : 'border-[#EEF0F4] hover:border-[#D1D5DB]'
              }`}
            >
              <h3 className="font-bold text-[#0E3470] text-lg mb-4">
                Option B: GP/LP Partnership
              </h3>
              <div className="space-y-2 mb-4">
                {[
                  { label: 'Acquisition Fee', value: deal.acq_fee },
                  { label: 'Asset Mgmt Fee', value: deal.asset_mgmt_fee },
                  { label: 'GP Carry', value: deal.gp_carry },
                  { label: 'Equity Required', value: deal.equity_required },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between py-1.5 border-b border-[#EEF0F4] last:border-b-0"
                  >
                    <span className="text-xs text-[#9CA3AF]">
                      {row.label}
                    </span>
                    <span className="text-sm font-semibold text-[#0E3470]">
                      {row.value ?? '--'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
                <div className="text-[10px] text-[#0B8A4D] uppercase font-semibold mb-1">
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
          </div>

          {/* IRR Calculator Panel */}
          <div className="mt-6">
            <IRRCalculatorPanel
              deal={deal}
              onSliderChange={handleIRRSliderChange}
            />
          </div>
        </div>
      </div>

      {/* ========== SCHEDULE & CONTACT TAB ========== */}
      <div
        className="transition-opacity duration-200"
        style={{ display: activeTab === 'schedule' ? 'block' : 'none' }}
      >
        <div className="mt-6 px-6 pb-8 grid grid-cols-[1fr_1fr] gap-6">
          {/* Left: Meeting Scheduler */}
          <div className="bg-white rounded-xl border border-[#EEF0F4] p-6">
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
            {/* Contact Card */}
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0E3470] to-[#1D5FB8] flex items-center justify-center shrink-0">
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-[#BC9C45] text-[#BC9C45] hover:bg-[#FDF8ED] font-semibold text-sm rounded-xl transition-colors"
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
                  Email About This Deal
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

            {/* Notification Preferences */}
            <div className="bg-white rounded-xl border border-[#EEF0F4] p-6">
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
                Notification Preferences
              </h4>
              <div className="space-y-2.5">
                {(
                  [
                    { key: 'deadline' as const, label: 'Deadline reminders' },
                    {
                      key: 'documents' as const,
                      label: 'New document uploads',
                    },
                    {
                      key: 'meetings' as const,
                      label: 'Meeting confirmations',
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
            </div>

            {/* Scarcity Indicator */}
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-sm font-semibold text-[#DC2626]">
                  Limited Release
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
    </div>
  );
}
