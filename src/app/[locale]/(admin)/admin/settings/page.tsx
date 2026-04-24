'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { REPRIME_STANDARD_FEES } from '@/lib/utils/fee-resolver';

interface ContactInfo {
  contact_name: string;
  contact_title: string;
  contact_email: string;
}

interface FeeDefaultsForm {
  assignment_fee: string;
  acq_fee: string;
  asset_mgmt_fee: string;
  gp_carry: string;
  pref_return: string;
}

interface DaySlot {
  enabled: boolean;
  start_time: string;
  end_time: string;
}

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAY_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

const DURATION_OPTIONS = [15, 30, 45, 60];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30];

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 7; h <= 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      options.push(`${hh}:${mm}`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

function formatTime(time: string): string {
  const [hh, mm] = time.split(':');
  const h = parseInt(hh, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mm} ${ampm}`;
}

function getDefaultSlots(): Record<DayOfWeek, DaySlot> {
  const slots: Partial<Record<DayOfWeek, DaySlot>> = {};
  for (const day of DAY_ORDER) {
    const isWeekday = day >= 1 && day <= 5;
    slots[day] = {
      enabled: isWeekday,
      start_time: '09:00',
      end_time: '17:00',
    };
  }
  return slots as Record<DayOfWeek, DaySlot>;
}

export default function SettingsPage() {
  const t = useTranslations('admin.settings');
  const tc = useTranslations('common');
  const supabase = createClient();

  const DAY_LABELS: Record<DayOfWeek, string> = {
    1: t('monday'),
    2: t('tuesday'),
    3: t('wednesday'),
    4: t('thursday'),
    5: t('friday'),
    6: t('saturday'),
    0: t('sunday'),
  };

  // Contact info state
  const [contact, setContact] = useState<ContactInfo>({
    contact_name: '',
    contact_title: '',
    contact_email: '',
  });
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  // Availability state
  const [slots, setSlots] = useState<Record<DayOfWeek, DaySlot>>(getDefaultSlots());
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [bufferTime, setBufferTime] = useState(15);
  const [availSaving, setAvailSaving] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);

  // Fee defaults state
  const [feeDefaults, setFeeDefaults] = useState<FeeDefaultsForm>({
    assignment_fee: String(REPRIME_STANDARD_FEES.assignmentFee),
    acq_fee: String(REPRIME_STANDARD_FEES.acqFee),
    asset_mgmt_fee: String(REPRIME_STANDARD_FEES.assetMgmtFee),
    gp_carry: String(REPRIME_STANDARD_FEES.gpCarry),
    pref_return: String(REPRIME_STANDARD_FEES.prefReturn),
  });
  const [feeDefaultsSaving, setFeeDefaultsSaving] = useState(false);
  const [feeDefaultsSaved, setFeeDefaultsSaved] = useState(false);

  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    setLoading(true);

    // Load contact + meeting + fee-default settings
    const { data: settings } = await supabase
      .from('terminal_settings')
      .select('key, value')
      .in('key', [
        'contact_name',
        'contact_title',
        'contact_email',
        'meeting_duration',
        'buffer_time',
        'default_assignment_fee',
        'default_acq_fee',
        'default_asset_mgmt_fee',
        'default_gp_carry',
        'default_pref_return',
      ]);

    if (settings) {
      const settingsMap = new Map(settings.map((s) => [s.key, s.value]));
      setContact({
        contact_name: (settingsMap.get('contact_name') as string) ?? '',
        contact_title: (settingsMap.get('contact_title') as string) ?? '',
        contact_email: (settingsMap.get('contact_email') as string) ?? '',
      });
      if (settingsMap.has('meeting_duration')) {
        setMeetingDuration(Number(settingsMap.get('meeting_duration')));
      }
      if (settingsMap.has('buffer_time')) {
        setBufferTime(Number(settingsMap.get('buffer_time')));
      }
      setFeeDefaults({
        assignment_fee: (settingsMap.get('default_assignment_fee') as string) ?? String(REPRIME_STANDARD_FEES.assignmentFee),
        acq_fee: (settingsMap.get('default_acq_fee') as string) ?? String(REPRIME_STANDARD_FEES.acqFee),
        asset_mgmt_fee: (settingsMap.get('default_asset_mgmt_fee') as string) ?? String(REPRIME_STANDARD_FEES.assetMgmtFee),
        gp_carry: (settingsMap.get('default_gp_carry') as string) ?? String(REPRIME_STANDARD_FEES.gpCarry),
        pref_return: (settingsMap.get('default_pref_return') as string) ?? String(REPRIME_STANDARD_FEES.prefReturn),
      });
    }

    // Load availability slots
    const { data: availSlots } = await supabase
      .from('terminal_availability_slots')
      .select('day_of_week, start_time, end_time, is_active');

    if (availSlots && availSlots.length > 0) {
      const newSlots = getDefaultSlots();
      for (const slot of availSlots) {
        const day = slot.day_of_week as DayOfWeek;
        newSlots[day] = {
          enabled: slot.is_active,
          start_time: slot.start_time,
          end_time: slot.end_time,
        };
      }
      setSlots(newSlots);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveContact = async () => {
    setContactSaving(true);
    setContactSaved(false);

    const entries = [
      { key: 'contact_name', value: contact.contact_name },
      { key: 'contact_title', value: contact.contact_title },
      { key: 'contact_email', value: contact.contact_email },
    ];

    for (const entry of entries) {
      await supabase
        .from('terminal_settings')
        .upsert(
          { key: entry.key, value: entry.value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
    }

    setContactSaving(false);
    setContactSaved(true);
    setTimeout(() => setContactSaved(false), 2500);
  };

  const handleSaveAvailability = async () => {
    setAvailSaving(true);
    setAvailSaved(false);

    // Upsert each day slot
    for (const day of DAY_ORDER) {
      const slot = slots[day];
      await supabase
        .from('terminal_availability_slots')
        .upsert(
          {
            day_of_week: day,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_active: slot.enabled,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          { onConflict: 'day_of_week' }
        );
    }

    // Save meeting duration and buffer time
    await supabase
      .from('terminal_settings')
      .upsert(
        { key: 'meeting_duration', value: meetingDuration, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    await supabase
      .from('terminal_settings')
      .upsert(
        { key: 'buffer_time', value: bufferTime, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    setAvailSaving(false);
    setAvailSaved(true);
    setTimeout(() => setAvailSaved(false), 2500);
  };

  const handleSaveFeeDefaults = async () => {
    setFeeDefaultsSaving(true);
    setFeeDefaultsSaved(false);

    const entries = [
      { key: 'default_assignment_fee', value: feeDefaults.assignment_fee },
      { key: 'default_acq_fee', value: feeDefaults.acq_fee },
      { key: 'default_asset_mgmt_fee', value: feeDefaults.asset_mgmt_fee },
      { key: 'default_gp_carry', value: feeDefaults.gp_carry },
      { key: 'default_pref_return', value: feeDefaults.pref_return },
    ];

    for (const entry of entries) {
      await supabase
        .from('terminal_settings')
        .upsert(
          { key: entry.key, value: entry.value, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
    }

    setFeeDefaultsSaving(false);
    setFeeDefaultsSaved(true);
    setTimeout(() => setFeeDefaultsSaved(false), 2500);
  };

  const updateSlot = (day: DayOfWeek, patch: Partial<DaySlot>) => {
    setSlots((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  };

  const selectClass =
    'px-3 py-2 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors';

  if (loading) {
    return (
      <div>
        <h1 className="text-[24px] font-bold text-rp-navy mb-6">{t('title')}</h1>
        <div className="bg-white rounded-2xl border border-rp-gray-200 p-8 text-center">
          <p className="text-sm text-rp-gray-400">{t('loadingSettings')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[24px] font-bold text-rp-navy mb-6">{t('title')}</h1>

      {/* Section 1: Contact Information */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">{t('contactInfo')}</h2>
        <div className="flex flex-col gap-4 max-w-lg">
          <Input
            label={t('contactName')}
            value={contact.contact_name}
            onChange={(e) => setContact((prev) => ({ ...prev, contact_name: e.target.value }))}
            placeholder={t('contactNamePlaceholder')}
          />
          <Input
            label={t('contactTitle')}
            value={contact.contact_title}
            onChange={(e) => setContact((prev) => ({ ...prev, contact_title: e.target.value }))}
            placeholder={t('contactTitlePlaceholder')}
          />
          <Input
            label={t('contactEmail')}
            type="email"
            value={contact.contact_email}
            onChange={(e) => setContact((prev) => ({ ...prev, contact_email: e.target.value }))}
            placeholder={t('contactEmailPlaceholder')}
          />
          <div className="flex items-center gap-3 mt-1">
            <Button variant="gold" loading={contactSaving} onClick={handleSaveContact}>
              {t('saveContactInfo')}
            </Button>
            {contactSaved && (
              <span className="text-sm text-green-600 font-medium">{tc('saved')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: REPRIME Standard Fee Terms */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-1.5">{t('feeDefaults')}</h2>
        <p className="text-[13px] text-rp-gray-400 mb-5">{t('feeDefaultsDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <Input
            label={t('assignmentFeePct')}
            type="number"
            step="0.01"
            value={feeDefaults.assignment_fee}
            onChange={(e) => setFeeDefaults((prev) => ({ ...prev, assignment_fee: e.target.value }))}
          />
          <Input
            label={t('acqFeePct')}
            type="number"
            step="0.01"
            value={feeDefaults.acq_fee}
            onChange={(e) => setFeeDefaults((prev) => ({ ...prev, acq_fee: e.target.value }))}
          />
          <Input
            label={t('assetMgmtFeePct')}
            type="number"
            step="0.01"
            value={feeDefaults.asset_mgmt_fee}
            onChange={(e) => setFeeDefaults((prev) => ({ ...prev, asset_mgmt_fee: e.target.value }))}
          />
          <Input
            label={t('gpCarryPct')}
            type="number"
            step="0.01"
            value={feeDefaults.gp_carry}
            onChange={(e) => setFeeDefaults((prev) => ({ ...prev, gp_carry: e.target.value }))}
          />
          <Input
            label={t('prefReturnPct')}
            type="number"
            step="0.01"
            value={feeDefaults.pref_return}
            onChange={(e) => setFeeDefaults((prev) => ({ ...prev, pref_return: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-3 mt-5">
          <Button variant="gold" loading={feeDefaultsSaving} onClick={handleSaveFeeDefaults}>
            {t('saveDefaults')}
          </Button>
          {feeDefaultsSaved && (
            <span className="text-sm text-green-600 font-medium">{tc('saved')}</span>
          )}
        </div>
      </div>

      {/* Section 3: Meeting Availability */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">{t('meetingAvailability')}</h2>

        {/* Day rows */}
        <div className="flex flex-col gap-3 mb-6">
          {DAY_ORDER.map((day) => {
            const slot = slots[day];
            return (
              <div
                key={day}
                className="flex items-center gap-4 py-2"
              >
                {/* Toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={slot.enabled}
                  onClick={() => updateSlot(day, { enabled: !slot.enabled })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out cursor-pointer ${
                    slot.enabled ? 'bg-rp-gold' : 'bg-rp-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
                      slot.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>

                {/* Day label */}
                <span className={`w-24 text-sm font-medium ${slot.enabled ? 'text-rp-navy' : 'text-rp-gray-400'}`}>
                  {DAY_LABELS[day]}
                </span>

                {/* Time selects */}
                {slot.enabled ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={slot.start_time}
                      onChange={(e) => updateSlot(day, { start_time: e.target.value })}
                      className={selectClass}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {formatTime(time)}
                        </option>
                      ))}
                    </select>
                    <span className="text-rp-gray-400 text-sm">{t('to')}</span>
                    <select
                      value={slot.end_time}
                      onChange={(e) => updateSlot(day, { end_time: e.target.value })}
                      className={selectClass}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {formatTime(time)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-sm text-rp-gray-400">{t('unavailable')}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Duration & Buffer */}
        <div className="flex flex-wrap gap-6 mb-6">
          <div>
            <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
              {t('meetingDuration')}
            </label>
            <select
              value={meetingDuration}
              onChange={(e) => setMeetingDuration(Number(e.target.value))}
              className={selectClass}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {t('minutes', { count: d })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
              {t('bufferTime')}
            </label>
            <select
              value={bufferTime}
              onChange={(e) => setBufferTime(Number(e.target.value))}
              className={selectClass}
            >
              {BUFFER_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {t('minutes', { count: b })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="gold" loading={availSaving} onClick={handleSaveAvailability}>
            {t('saveAvailability')}
          </Button>
          {availSaved && (
            <span className="text-sm text-green-600 font-medium">{tc('saved')}</span>
          )}
        </div>
      </div>
    </div>
  );
}
