'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { TerminalAvailabilitySlot } from '@/lib/types/database';

export function MeetingScheduler({
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

  const slotsByDay = useMemo(() => {
    const map = new Map<number, TerminalAvailabilitySlot[]>();
    for (const s of slots) {
      const existing = map.get(s.day_of_week) ?? [];
      existing.push(s);
      map.set(s.day_of_week, existing);
    }
    return map;
  }, [slots]);

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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0B8A4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
