'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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

  const panelClass = isExpired
    ? 'bg-rp-gray-300'
    : isUrgent
      ? 'bg-rp-red'
      : 'bg-rp-navy';

  const groups: { value: number; unit: string }[] = [
    { value: days, unit: 'DAYS' },
    { value: hours, unit: 'HRS' },
    { value: minutes, unit: 'MIN' },
    { value: seconds, unit: 'SEC' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-rp-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-rp-gray-500 uppercase tracking-wider">
          {label}
        </span>
        {isUrgent && !isExpired && (
          <span className="bg-rp-red text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
            URGENT
          </span>
        )}
        {isExpired && (
          <span className="text-rp-gray-400 text-[10px] font-semibold uppercase">
            EXPIRED
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {groups.map((g) => (
          <div key={g.unit} className="flex flex-col items-center">
            <div
              className={`${panelClass} text-white rounded-lg w-[58px] h-[68px] flex items-center justify-center text-2xl font-extrabold`}
            >
              {String(g.value).padStart(2, '0')}
            </div>
            <span className="text-[9px] text-rp-gray-400 mt-1 font-medium">
              {g.unit}
            </span>
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
      <div className="w-full h-full min-h-[340px] bg-rp-gray-100 rounded-2xl flex items-center justify-center">
        <span className="text-rp-gray-400 text-sm">No photos available</span>
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
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous photo"
          >
            <svg
              width="16"
              height="16"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next photo"
          >
            <svg
              width="16"
              height="16"
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
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {urls.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === current ? 'bg-white' : 'bg-white/50'
                }`}
                aria-label={`Go to photo ${idx + 1}`}
              />
            ))}
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
  isReturn,
}: {
  label: string;
  value: string | null;
  isReturn?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-rp-gray-200 p-3 border-t-[3px] border-t-rp-gold">
      <div className="text-[10px] text-rp-gray-400 uppercase font-semibold tracking-wider mb-1">
        {label}
      </div>
      <div
        className={`text-lg font-bold ${isReturn ? 'text-rp-green' : 'text-rp-navy'}`}
      >
        {value ?? '--'}
      </div>
    </div>
  );
}

/* ---------- File Type Icon ---------- */

function FileTypeIcon({ fileType }: { fileType: string | null }) {
  const ext = fileType?.toLowerCase() ?? '';
  let color = 'text-rp-gray-400';
  let label = 'FILE';

  if (ext.includes('pdf')) {
    color = 'text-rp-red';
    label = 'PDF';
  } else if (ext.includes('sheet') || ext.includes('xlsx')) {
    color = 'text-rp-green';
    label = 'XLS';
  } else if (ext.includes('word') || ext.includes('docx')) {
    color = 'text-rp-blue';
    label = 'DOC';
  } else if (ext.includes('zip')) {
    color = 'text-rp-amber';
    label = 'ZIP';
  }

  return (
    <div
      className={`w-9 h-9 rounded-lg bg-rp-gray-100 flex items-center justify-center text-[10px] font-bold ${color}`}
    >
      {label}
    </div>
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

  return (
    <div className="bg-white rounded-xl border border-rp-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 hover:bg-rp-gray-100/50 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-rp-gold-bg flex items-center justify-center text-lg">
          {folder.icon ?? '📁'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-rp-navy truncate">
            {folder.name}
          </div>
          <div className="text-[11px] text-rp-gray-400">
            {docCount} document{docCount !== 1 ? 's' : ''} &middot;{' '}
            {verifiedCount} verified
          </div>
        </div>
        <div className="flex items-center gap-2">
          {verifiedCount === docCount && docCount > 0 && (
            <div className="w-5 h-5 rounded-full bg-rp-green-light flex items-center justify-center">
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
            className={`text-rp-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-rp-gray-200">
          {folder.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-rp-gray-100 last:border-b-0"
            >
              <FileTypeIcon fileType={doc.file_type} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-rp-navy font-medium truncate">
                  {doc.name}
                </div>
                <div className="text-[11px] text-rp-gray-400">
                  {doc.file_size ?? 'Unknown size'}
                </div>
              </div>
              {doc.is_verified && (
                <span className="text-[10px] font-semibold text-rp-green bg-rp-green-light px-2 py-0.5 rounded-full">
                  Verified
                </span>
              )}
              <a
                href={`/api/documents/${doc.id}/download`}
                onClick={() => onDocumentDownload(doc.id)}
                className="w-8 h-8 rounded-lg bg-rp-gray-100 hover:bg-rp-gold-bg flex items-center justify-center text-rp-gray-500 hover:text-rp-navy transition-colors"
                aria-label={`Download ${doc.name}`}
              >
                <svg
                  width="14"
                  height="14"
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
            <div className="px-4 py-6 text-center text-sm text-rp-gray-400">
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
    <div className="bg-rp-navy rounded-2xl p-6 text-white">
      <h3 className="font-bold text-lg mb-4">IRR Calculator</h3>

      {/* Mode tabs */}
      <div className="flex rounded-lg bg-white/10 p-1 mb-6">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex-1 text-xs font-semibold py-2 rounded-md transition-colors ${
              mode === m.key
                ? 'bg-white text-rp-navy'
                : 'text-white/70 hover:text-white'
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
            <div className="text-3xl font-extrabold text-rp-gold">
              {deal.assignment_irr ?? '--'}
            </div>
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
            <div className="text-3xl font-extrabold text-rp-gold">
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
                className="w-full accent-rp-gold h-1.5"
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
                className="w-full accent-rp-gold h-1.5"
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
                className="w-full accent-rp-gold h-1.5"
              />
              <div className="flex justify-between text-[10px] text-white/40 mt-1">
                <span>0%</span>
                <span>3%</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-white/60 text-xs mb-1">Calculated IRR</div>
            <div className="text-3xl font-extrabold text-rp-gold">
              {customIRR.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/10 text-[11px] text-white/50">
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
      <div className="bg-rp-green-light border border-rp-green/20 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-rp-green/10 flex items-center justify-center mx-auto mb-3">
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
        <h4 className="text-lg font-bold text-rp-navy mb-1">
          Meeting scheduled!
        </h4>
        <p className="text-sm text-rp-gray-500">
          You will receive a confirmation email shortly.
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
                <div className="text-[10px] text-rp-gray-400 font-medium">
                  {dayLabels[day.getDay()]}
                </div>
                <div className="text-xs font-semibold text-rp-navy">
                  {day.getDate()}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {timeSlots.length === 0 && (
                  <div className="text-[9px] text-rp-gray-300 text-center py-2">
                    --
                  </div>
                )}
                {timeSlots.map((ts) => (
                  <button
                    key={ts.isoString}
                    onClick={() => setSelectedSlot(ts.isoString)}
                    className={`text-[10px] py-1.5 px-1 rounded-md transition-colors font-medium ${
                      selectedSlot === ts.isoString
                        ? 'bg-rp-gold-bg border-2 border-rp-gold text-rp-navy'
                        : 'bg-rp-gray-100 hover:bg-rp-gold-bg text-rp-gray-600 border-2 border-transparent'
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
            className="w-full py-3 bg-rp-gold hover:bg-rp-gold-soft text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {confirming ? 'Scheduling...' : 'Confirm Meeting'}
          </button>
        </div>
      )}

      <div className="mt-3 text-center">
        <span className="text-xs text-rp-gray-400">
          None of these work?{' '}
          <a
            href={`mailto:?subject=Meeting%20Request`}
            className="text-rp-gold hover:underline"
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
    <div className="min-h-screen bg-rp-page-bg font-[family-name:var(--font-poppins)]">
      {/* ---- Sticky Top Nav ---- */}
      <div className="sticky top-0 z-30 bg-white h-14 border-b border-rp-gray-200 flex items-center px-6">
        <button
          onClick={() => router.push(`/${locale}/portal`)}
          className="flex items-center gap-2 text-rp-gray-500 hover:text-rp-navy transition-colors mr-3"
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
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
        </button>
        <h1 className="font-bold text-rp-navy text-base truncate flex-1">
          {deal.name}
        </h1>
        <div className="flex items-center gap-1.5 ml-4 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-rp-navy flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">RP</span>
          </div>
        </div>
      </div>

      {/* ---- Hero Section ---- */}
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

      {/* ---- 7-Metric Bar ---- */}
      <div className="grid grid-cols-7 gap-3 px-6">
        <MetricCard label="Purchase Price" value={deal.purchase_price} />
        <MetricCard label="NOI" value={deal.noi} />
        <MetricCard label="Cap Rate" value={deal.cap_rate} />
        <MetricCard label="IRR" value={deal.irr} isReturn />
        <MetricCard label="CoC" value={deal.coc} isReturn />
        <MetricCard label="DSCR" value={deal.dscr} />
        <MetricCard label="Equity Required" value={deal.equity_required} />
      </div>

      {/* ---- Tabs ---- */}
      <div className="px-6 mt-6">
        <div className="flex border-b border-rp-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-rp-navy font-semibold border-b-[3px] border-rp-gold -mb-px'
                  : 'text-rp-gray-500 hover:text-rp-navy'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Tab Content ---- */}
      <div className="px-6 py-6">
        {/* ========== OVERVIEW TAB ========== */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-[1fr_340px] gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Investment Highlights */}
              {deal.investment_highlights &&
                deal.investment_highlights.length > 0 && (
                  <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-rp-navy mb-4">
                      Investment Highlights
                    </h3>
                    <div className="space-y-3">
                      {deal.investment_highlights.map((highlight, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="bg-rp-green-light text-rp-green rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0 mt-0.5">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 8l4 4 6-7" />
                            </svg>
                          </div>
                          <span className="text-sm text-rp-gray-600">
                            {highlight}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Acquisition Thesis */}
              {deal.acquisition_thesis && (
                <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-rp-navy mb-3">
                    Acquisition Thesis
                  </h3>
                  <p className="text-sm text-rp-gray-600 leading-relaxed">
                    {deal.acquisition_thesis}
                  </p>
                </div>
              )}

              {/* Financing Summary */}
              <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
                <h3 className="text-sm font-semibold text-rp-navy mb-4">
                  Financing Summary
                </h3>
                <div className="space-y-2">
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
                      className="flex justify-between py-2 border-b border-rp-gray-100 last:border-b-0"
                    >
                      <span className="text-xs text-rp-gray-400">
                        {row.label}
                      </span>
                      <span className="text-sm font-semibold text-rp-navy">
                        {row.value ?? '--'}
                      </span>
                    </div>
                  ))}
                </div>

                {deal.special_terms && deal.special_terms !== 'None' && (
                  <div className="mt-4 bg-rp-gold-bg border-l-4 border-rp-gold p-4 rounded-r-lg">
                    <div className="text-[11px] font-semibold text-rp-gold uppercase tracking-wider mb-1">
                      Special Terms
                    </div>
                    <p className="text-sm text-rp-gray-600">
                      {deal.special_terms}
                    </p>
                  </div>
                )}
              </div>

              {/* Market Context */}
              <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
                <h3 className="text-sm font-semibold text-rp-navy mb-4">
                  Market Context
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-rp-gray-100 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 rounded-full bg-rp-blue/10 flex items-center justify-center mx-auto mb-2">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#1D5FB8"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87" />
                        <path d="M16 3.13a4 4 0 010 7.75" />
                      </svg>
                    </div>
                    <div className="text-[10px] text-rp-gray-400 uppercase font-semibold mb-0.5">
                      Metro Population
                    </div>
                    <div className="text-sm font-bold text-rp-navy">
                      {deal.metro_population ?? '--'}
                    </div>
                  </div>

                  <div className="bg-rp-gray-100 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 rounded-full bg-rp-green/10 flex items-center justify-center mx-auto mb-2">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0B8A4D"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
                      </svg>
                    </div>
                    <div className="text-[10px] text-rp-gray-400 uppercase font-semibold mb-0.5">
                      Job Growth
                    </div>
                    <div className="text-sm font-bold text-rp-navy">
                      {deal.job_growth ?? '--'}
                    </div>
                  </div>

                  <div className="bg-rp-gray-100 rounded-xl p-4 text-center">
                    <div className="w-8 h-8 rounded-full bg-rp-gold/10 flex items-center justify-center mx-auto mb-2">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#BC9C45"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18" />
                        <path d="M9 21V9" />
                      </svg>
                    </div>
                    <div className="text-[10px] text-rp-gray-400 uppercase font-semibold mb-0.5">
                      Occupancy
                    </div>
                    <div className="text-sm font-bold text-rp-navy">
                      {deal.occupancy ?? '--'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (Sidebar) */}
            <div className="space-y-6">
              {/* Property Details */}
              <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
                <h3 className="text-sm font-semibold text-rp-navy mb-4">
                  Property Details
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'Type', value: deal.property_type },
                    { label: 'Class', value: deal.class_type },
                    {
                      label: 'Year Built',
                      value: deal.year_built?.toString(),
                    },
                    { label: 'Sq Ft', value: deal.square_footage },
                    { label: 'Units', value: deal.units },
                    { label: 'Neighborhood', value: deal.neighborhood },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex justify-between py-2 border-b border-rp-gray-100 last:border-b-0"
                    >
                      <span className="text-xs text-rp-gray-400">
                        {row.label}
                      </span>
                      <span className="text-sm font-semibold text-rp-navy">
                        {row.value ?? '--'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Proof */}
              <div className="bg-rp-gold-bg rounded-2xl border border-rp-gold-border p-4 text-center">
                <p className="text-sm text-rp-navy font-medium">
                  <span className="font-bold">{deal.viewing_count}</span>{' '}
                  investors reviewing &middot;{' '}
                  <span className="font-bold">{deal.meetings_count}</span>{' '}
                  meetings scheduled
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========== DUE DILIGENCE TAB ========== */}
        {activeTab === 'due-diligence' && (
          <div>
            {/* Progress Bar */}
            <div className="bg-white rounded-2xl border border-rp-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-rp-navy">
                  Document Verification Progress
                </span>
                <span className="text-sm font-bold text-rp-navy">
                  {ddProgress}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-rp-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rp-green to-emerald-400 transition-all duration-500"
                  style={{ width: `${ddProgress}%` }}
                />
              </div>
              <div className="mt-2 text-[11px] text-rp-gray-400">
                {verifiedDocs} of {totalDocs} documents verified
              </div>
            </div>

            {/* Download Complete Package */}
            <div className="mb-6 flex justify-end">
              <a
                href={`/api/deals/${deal.id}/package`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rp-navy hover:bg-rp-navy/90 text-white text-sm font-semibold rounded-xl transition-colors"
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
            <div className="grid grid-cols-2 gap-4">
              {deal.dd_folders.map((folder) => (
                <DDFolderCard
                  key={folder.id}
                  folder={folder}
                  dealId={deal.id}
                  onDocumentDownload={handleDocumentDownload}
                />
              ))}
              {deal.dd_folders.length === 0 && (
                <div className="col-span-2 bg-white rounded-2xl border border-rp-gray-200 p-12 text-center">
                  <p className="text-sm text-rp-gray-400">
                    No due diligence documents available yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== DEAL STRUCTURE TAB ========== */}
        {activeTab === 'deal-structure' && (
          <div className="grid grid-cols-[1fr_340px] gap-6">
            {/* Left: Option Cards */}
            <div className="grid grid-cols-2 gap-6">
              {/* Option A: Assignment */}
              <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
                <h3 className="font-bold text-rp-navy mb-4">
                  Option A: Assignment
                </h3>
                <div className="mb-4">
                  <div className="text-xs text-rp-gray-400 mb-1">
                    Assignment Fee
                  </div>
                  <div className="text-2xl font-bold text-rp-navy">
                    {deal.assignment_fee}
                  </div>
                </div>
                <p className="text-sm text-rp-gray-500 mb-4">
                  Clean assignment of contract with fixed fee. All projected
                  returns account for the assignment fee.
                </p>
                <div className="bg-rp-green-light p-4 rounded-xl mb-4">
                  <div className="text-[10px] text-rp-green uppercase font-semibold mb-1">
                    Projected IRR
                  </div>
                  <div className="text-2xl font-bold text-rp-green">
                    {deal.assignment_irr ?? '--'}
                  </div>
                </div>
                <p className="text-[11px] text-rp-gray-400 mb-4">
                  Fee included in projected returns
                </p>
                <div className="border-t border-rp-gray-100 pt-4">
                  <div className="text-[11px] font-semibold text-rp-gray-500 uppercase mb-2">
                    Optional Add-ons
                  </div>
                  <label className="flex items-center gap-2 text-sm text-rp-gray-600 mb-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold/20"
                    />
                    Loan Placement
                  </label>
                  <label className="flex items-center gap-2 text-sm text-rp-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold/20"
                    />
                    Insurance Placement
                  </label>
                </div>
              </div>

              {/* Option B: GP/LP Partnership */}
              <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
                <h3 className="font-bold text-rp-navy mb-4">
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
                      className="flex justify-between py-1.5 border-b border-rp-gray-100 last:border-b-0"
                    >
                      <span className="text-xs text-rp-gray-400">
                        {row.label}
                      </span>
                      <span className="text-sm font-semibold text-rp-navy">
                        {row.value ?? '--'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="bg-rp-green-light p-4 rounded-xl mb-4">
                  <div className="text-[10px] text-rp-green uppercase font-semibold mb-1">
                    Projected IRR
                  </div>
                  <div className="text-2xl font-bold text-rp-green">
                    {deal.gplp_irr ?? '--'}
                  </div>
                </div>
                <p className="text-[11px] text-rp-gray-400">
                  Loan placement &middot; Insurance &middot; On-site inspection
                  &mdash; all included
                </p>
              </div>
            </div>

            {/* Right: IRR Calculator */}
            <IRRCalculatorPanel
              deal={deal}
              onSliderChange={handleIRRSliderChange}
            />
          </div>
        )}

        {/* ========== SCHEDULE & CONTACT TAB ========== */}
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Meeting Scheduler */}
            <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
              <h3 className="text-sm font-semibold text-rp-navy mb-4">
                Schedule a Meeting
              </h3>
              <MeetingScheduler
                dealId={deal.id}
                slots={availabilitySlots}
                bookedTimes={bookedTimes}
                onMeetingRequested={handleMeetingRequested}
              />
            </div>

            {/* Right: Contact Card */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rp-navy to-rp-blue flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-lg">
                      {initials || 'RP'}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-rp-navy">
                      {contactName || 'RePrime Team'}
                    </div>
                    <div className="text-xs text-rp-gray-400">
                      {contactTitle || 'Investment Advisor'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(`RE: ${deal.name}`)}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-rp-gold hover:bg-rp-gold-soft text-white font-semibold text-sm rounded-xl transition-colors"
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-rp-gray-200 hover:border-rp-gold text-rp-navy font-semibold text-sm rounded-xl transition-colors"
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
              <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
                <h4 className="text-xs font-semibold text-rp-gray-500 uppercase tracking-wider mb-3">
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
                        className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold/20"
                      />
                      <span className="text-sm text-rp-gray-600">
                        {pref.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Scarcity Indicator */}
              <div className="bg-rp-red-light p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-rp-red animate-pulse" />
                  <span className="text-[11px] font-bold text-rp-red uppercase tracking-wider">
                    Limited Release
                  </span>
                </div>
                <p className="text-xs text-rp-gray-600">
                  This deal is available to a select group of investors.
                  Availability is on a first-come, first-served basis.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
