'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import type { NotifPreferences, NotifEventKey, NotifChannel } from '@/lib/notifications/types';
import { friendlyAuthError, friendlyFetchError, readApiError } from '@/lib/utils/friendly-error';

interface Profile {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
}

interface SettingsClientProps {
  initialProfile: Profile;
  initialPrefs: NotifPreferences;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SettingsClient({ initialProfile, initialPrefs }: SettingsClientProps) {
  const t = useTranslations('portal.settings');
  const td = useTranslations('portal.dealDetail');

  // ---- Profile ----
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [profileSave, setProfileSave] = useState<SaveState>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);

  const profileDirty =
    profile.full_name.trim() !== initialProfile.full_name ||
    profile.phone.trim() !== initialProfile.phone ||
    profile.company_name.trim() !== initialProfile.company_name;

  async function saveProfile() {
    setProfileError(null);
    if (!profile.full_name.trim()) {
      setProfileError(t('nameRequired'));
      return;
    }
    setProfileSave('saving');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profile.full_name.trim(),
          phone: profile.phone.trim(),
          company_name: profile.company_name.trim(),
        }),
      });
      if (res.ok) {
        setProfileSave('saved');
        setTimeout(() => setProfileSave('idle'), 1800);
      } else {
        setProfileError(await readApiError(res, t('saveFailed')));
        setProfileSave('error');
      }
    } catch (err) {
      console.error('profile save failed:', err);
      setProfileError(friendlyFetchError(err, t('saveFailed')));
      setProfileSave('error');
    }
  }

  // ---- Password ----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSave, setPasswordSave] = useState<SaveState>('idle');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function changePassword() {
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError(t('currentPasswordRequired'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordMismatch'));
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError(t('passwordSameAsCurrent'));
      return;
    }

    setPasswordSave('saving');
    const supabase = createClient();

    // Verify current password by re-authenticating. Supabase's updateUser({ password })
    // does not require the old password, so we verify it here first.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });
    if (signInError) {
      setPasswordError(t('currentPasswordIncorrect'));
      setPasswordSave('error');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.error('password update failed:', error);
      setPasswordError(friendlyAuthError(error.message, t('saveFailed')));
      setPasswordSave('error');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSave('saved');
    setTimeout(() => setPasswordSave('idle'), 2200);
  }

  // ---- Notifications ----
  const [prefs, setPrefs] = useState<NotifPreferences>(initialPrefs);
  const [savedPrefs, setSavedPrefs] = useState<NotifPreferences>(initialPrefs);
  const [prefsSave, setPrefsSave] = useState<SaveState>('idle');
  const [prefsError, setPrefsError] = useState<string | null>(null);

  const prefsDirty = JSON.stringify(prefs) !== JSON.stringify(savedPrefs);
  const noChannelsSelected = !prefs.channels.email && !prefs.channels.in_app;

  function toggleEvent(event: NotifEventKey) {
    setPrefs((p) => ({ ...p, events: { ...p.events, [event]: !p.events[event] } }));
  }

  function toggleGlobalChannel(channel: NotifChannel) {
    setPrefs((p) => ({ ...p, channels: { ...p.channels, [channel]: !p.channels[channel] } }));
  }

  async function saveNotifPrefs() {
    setPrefsError(null);
    if (noChannelsSelected) {
      setPrefsError(t('chooseAtLeastOneChannel'));
      return;
    }
    setPrefsSave('saving');
    try {
      const res = await fetch('/api/user/notification-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs }),
      });
      if (res.ok) {
        setSavedPrefs(prefs);
        setPrefsSave('saved');
        setTimeout(() => setPrefsSave('idle'), 2000);
      } else {
        setPrefsError(await readApiError(res, t('saveFailed')));
        setPrefsSave('error');
      }
    } catch (err) {
      console.error('notif prefs save failed:', err);
      setPrefsError(friendlyFetchError(err, t('saveFailed')));
      setPrefsSave('error');
    }
  }

  const prefRows: { key: NotifEventKey; label: string; description: string }[] = [
    { key: 'new_deals', label: td('newDealsMatching'), description: t('eventNewDealsDesc') },
    { key: 'document_uploads', label: td('newDocumentUploads'), description: t('eventDocumentsDesc') },
    { key: 'deal_activity', label: td('dealActivityUpdates'), description: t('eventActivityDesc') },
  ];

  return (
    <div className="px-4 md:px-10 py-6 md:py-10 max-w-[960px] mx-auto">
      <div className="mb-6 md:mb-10">
        <h1 className="font-[family-name:var(--font-playfair)] text-[26px] md:text-[36px] font-semibold text-[#0E3470]">
          {t('title')}
        </h1>
        <p className="text-[13px] text-[#6B7280] mt-1">{t('subtitle')}</p>
      </div>

      {/* Profile */}
      <SectionCard title={t('profileTitle')} description={t('profileSubtitle')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t('fullName')}>
            <input
              type="text"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className={inputStyle}
            />
          </Field>
          <Field label={t('email')} hint={t('emailReadOnly')}>
            <input
              type="email"
              value={profile.email}
              readOnly
              className={`${inputStyle} bg-[#F9FAFB] text-[#6B7280] cursor-not-allowed`}
            />
          </Field>
          <Field label={t('phone')}>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className={inputStyle}
              placeholder="+1 555 555 5555"
            />
          </Field>
          <Field label={t('company')}>
            <input
              type="text"
              value={profile.company_name}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              className={inputStyle}
            />
          </Field>
        </div>
        {profileError && (
          <p className="text-[12px] text-[#DC2626] mt-3">{profileError}</p>
        )}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={saveProfile}
            disabled={!profileDirty || profileSave === 'saving'}
            className="px-5 py-2 rounded-lg bg-[#0E3470] text-white text-[13px] font-semibold hover:bg-[#0a2856] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {profileSave === 'saving' ? t('saving') : t('saveChanges')}
          </button>
          {profileSave === 'saved' && (
            <span className="text-[12px] text-[#0B8A4D] font-semibold">✓ {t('saved')}</span>
          )}
        </div>
      </SectionCard>

      {/* Password */}
      <SectionCard title={t('passwordTitle')} description={t('passwordSubtitle')}>
        <Field label={t('currentPassword')}>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputStyle}
            autoComplete="current-password"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Field label={t('newPassword')}>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputStyle}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t('confirmPassword')}>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputStyle}
              autoComplete="new-password"
            />
          </Field>
        </div>
        {passwordError && (
          <p className="text-[12px] text-[#DC2626] mt-3">{passwordError}</p>
        )}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={changePassword}
            disabled={passwordSave === 'saving' || !currentPassword || !newPassword || !confirmPassword}
            className="px-5 py-2 rounded-lg bg-[#0E3470] text-white text-[13px] font-semibold hover:bg-[#0a2856] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {passwordSave === 'saving' ? t('updating') : t('updatePassword')}
          </button>
          {passwordSave === 'saved' && (
            <span className="text-[12px] text-[#0B8A4D] font-semibold">✓ {t('passwordUpdated')}</span>
          )}
        </div>
      </SectionCard>

      {/* Notifications */}
      <SectionCard
        title={t('notificationsTitle')}
        description={t('notificationsSubtitle')}
      >
        {/* Event toggles */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280] mb-3">
            {t('notificationTypes')}
          </div>
          <div className="space-y-1">
            {prefRows.map((row, i) => {
              const on = prefs.events[row.key];
              return (
                <div
                  key={row.key}
                  className={`flex items-start justify-between gap-4 py-3.5 ${
                    i < prefRows.length - 1 ? 'border-b border-[#F3F4F6]' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-[14px] font-medium ${on ? 'text-[#0F1B2D]' : 'text-[#9CA3AF]'}`}>
                      {row.label}
                    </div>
                    <div className="text-[12px] text-[#9CA3AF] mt-0.5">
                      {row.description}
                    </div>
                  </div>
                  <Toggle
                    checked={on}
                    onChange={() => toggleEvent(row.key)}
                    label={row.label}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Global channel picker */}
        <div className="bg-[#F9FAFB] border border-[#EEF0F4] rounded-xl p-4 md:p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280] mb-1">
            {t('deliverChannels')}
          </div>
          <div className="text-[12px] text-[#9CA3AF] mb-3">
            {t('deliverChannelsHint')}
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <ChannelChoice
              active={prefs.channels.in_app}
              onClick={() => toggleGlobalChannel('in_app')}
              title={td('channelInApp')}
              description={t('channelInAppDesc')}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              }
            />
            <ChannelChoice
              active={prefs.channels.email}
              onClick={() => toggleGlobalChannel('email')}
              title={td('channelEmail')}
              description={t('channelEmailDesc')}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              }
            />
          </div>
        </div>

        {prefsError && (
          <p className="text-[12px] text-[#DC2626] mt-3">{prefsError}</p>
        )}

        {/* Save button */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={saveNotifPrefs}
            disabled={!prefsDirty || prefsSave === 'saving'}
            className="px-5 py-2 rounded-lg bg-[#0E3470] text-white text-[13px] font-semibold hover:bg-[#0a2856] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {prefsSave === 'saving' ? t('saving') : t('saveChanges')}
          </button>
          {prefsSave === 'saved' && (
            <span className="text-[12px] text-[#0B8A4D] font-semibold">✓ {t('saved')}</span>
          )}
          {prefsDirty && prefsSave === 'idle' && (
            <span className="text-[12px] text-[#BC9C45]">{t('unsavedChanges')}</span>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

const inputStyle =
  'w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#0F1B2D] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#C8A951]/20 focus:border-[#C8A951] transition-all';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6B7280] mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-[#9CA3AF] mt-1">{hint}</span>}
    </label>
  );
}

function SectionCard({
  title,
  description,
  rightSlot,
  children,
}: {
  title: string;
  description?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-[#EEF0F4] p-5 md:p-7 mb-5 md:mb-6 rp-card-shadow">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[17px] md:text-[19px] font-semibold text-[#0E3470]">{title}</h2>
          {description && <p className="text-[12px] text-[#6B7280] mt-1">{description}</p>}
        </div>
        {rightSlot && <div className="shrink-0 pt-1">{rightSlot}</div>}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 mt-0.5 ${
        checked ? 'bg-[#0E3470]' : 'bg-[#E5E7EB]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}

function ChannelChoice({
  active,
  onClick,
  title,
  description,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 text-start flex items-start gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
        active
          ? 'bg-white border-[#BC9C45] shadow-[0_0_0_3px_rgba(188,156,69,0.12)]'
          : 'bg-white border-[#E5E7EB] hover:border-[#D1D5DB]'
      }`}
    >
      <div className={`shrink-0 mt-0.5 ${active ? 'text-[#BC9C45]' : 'text-[#9CA3AF]'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-semibold ${active ? 'text-[#0F1B2D]' : 'text-[#6B7280]'}`}>
          {title}
        </div>
        <div className="text-[11px] text-[#9CA3AF] mt-0.5">
          {description}
        </div>
      </div>
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
          active ? 'bg-[#BC9C45] border-[#BC9C45]' : 'bg-white border-[#D1D5DB]'
        }`}
      >
        {active && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  );
}