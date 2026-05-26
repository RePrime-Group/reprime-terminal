'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type {
  CrmContactMethod,
  CrmInvestorStatus,
  CrmInvestmentPriority,
  TerminalCrmInvestor,
} from '@/lib/types/database';
import { createInvestor, updateInvestor, type CrmInvestorInput } from '@/app/[locale]/(admin)/admin/crm/actions';
import {
  STATUS_OPTIONS,
  CONTACT_METHODS,
  PROPERTY_TYPES,
  MARKETS,
  PRIORITIES,
  STRUCTURE_PREFERENCES,
} from './CrmConstants';
import { CrmAvatar } from './CrmAvatar';
import { uploadCrmFile } from './uploadCrmFile';

const inputCls =
  'w-full px-3 py-2 border border-rp-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold outline-none';
const labelCls = 'block text-[11px] font-semibold text-rp-gray-500 uppercase tracking-wider mb-1';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-rp-gray-200 rp-card-shadow p-5">
      <h2 className="text-sm font-bold text-rp-navy uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function num(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

export default function CrmInvestorFormClient({
  investor,
  locale,
}: {
  investor?: TerminalCrmInvestor;
  locale: string;
}) {
  const t = useTranslations('admin.crm');
  const router = useRouter();
  const isEdit = !!investor;
  const prefs = investor?.investment_preferences ?? {};

  const [form, setForm] = useState({
    first_name: investor?.first_name ?? '',
    last_name: investor?.last_name ?? '',
    company_name: investor?.company_name ?? '',
    title: investor?.title ?? '',
    photo_url: investor?.photo_url ?? '',
    email: investor?.email ?? '',
    phone: investor?.phone ?? '',
    whatsapp: investor?.whatsapp ?? '',
    linkedin_url: investor?.linkedin_url ?? '',
    preferred_contact_method: (investor?.preferred_contact_method ?? 'email') as CrmContactMethod,
    address_line1: investor?.address_line1 ?? '',
    address_line2: investor?.address_line2 ?? '',
    city: investor?.city ?? '',
    state: investor?.state ?? '',
    zip: investor?.zip ?? '',
    country: investor?.country ?? 'US',
    status: (investor?.status ?? 'lead') as CrmInvestorStatus,
    source: investor?.source ?? '',
    referred_by: investor?.referred_by ?? '',
    entity_type: investor?.entity_type ?? '',
    is_accredited: investor?.is_accredited ?? false,
    equity_ready: investor?.equity_ready ?? '',
    equity_committed: investor?.equity_committed ?? '',
    equity_timeline: investor?.equity_timeline ?? '',
    internal_notes: investor?.internal_notes ?? '',
  });

  const [propertyTypes, setPropertyTypes] = useState<string[]>(prefs.property_types ?? []);
  const [markets, setMarkets] = useState<string[]>(prefs.markets ?? []);
  const [structures, setStructures] = useState<string[]>(prefs.structure_preferences ?? []);
  const [minCheck, setMinCheck] = useState(prefs.min_check_size != null ? String(prefs.min_check_size) : '');
  const [maxCheck, setMaxCheck] = useState(prefs.max_check_size != null ? String(prefs.max_check_size) : '');
  const [returnRate, setReturnRate] = useState(
    prefs.preferred_return_rate != null ? String(prefs.preferred_return_rate) : '',
  );
  const [holdPeriod, setHoldPeriod] = useState(prefs.hold_period_years ?? '');
  const [priority, setPriority] = useState<CrmInvestmentPriority | ''>(prefs.priority ?? '');
  const [acceptsMezz, setAcceptsMezz] = useState<boolean>(prefs.accepts_seller_mezz ?? false);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggle = (list: string[], setter: (v: string[]) => void, value: string) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const handlePhoto = async (file: File) => {
    setPhotoUploading(true);
    setError(null);
    const res = await uploadCrmFile('terminal-investor-photos', `${investor?.id ?? 'new'}/photo`, file);
    if (res.error || !res.data) {
      setError(t('uploadFailed'));
    } else {
      set('photo_url', res.data.url);
    }
    setPhotoUploading(false);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError(t('saveFailed'));
      return;
    }
    setSaving(true);
    setError(null);

    const input: CrmInvestorInput = {
      first_name: form.first_name,
      last_name: form.last_name,
      company_name: form.company_name || null,
      title: form.title || null,
      photo_url: form.photo_url || null,
      email: form.email || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      linkedin_url: form.linkedin_url || null,
      preferred_contact_method: form.preferred_contact_method,
      address_line1: form.address_line1 || null,
      address_line2: form.address_line2 || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      country: form.country || null,
      status: form.status,
      source: form.source || null,
      referred_by: form.referred_by || null,
      entity_type: form.entity_type || null,
      is_accredited: form.is_accredited,
      equity_ready: num(form.equity_ready),
      equity_committed: num(form.equity_committed),
      equity_timeline: form.equity_timeline || null,
      internal_notes: form.internal_notes || null,
      investment_preferences: {
        property_types: propertyTypes,
        markets,
        structure_preferences: structures,
        min_check_size: num(minCheck),
        max_check_size: num(maxCheck),
        preferred_return_rate: num(returnRate),
        hold_period_years: holdPeriod || null,
        priority: priority || null,
        accepts_seller_mezz: acceptsMezz,
      },
    };

    const result = isEdit ? await updateInvestor(investor!.id, input) : await createInvestor(input);

    if (!result.ok) {
      setError(result.error || t('saveFailed'));
      setSaving(false);
      return;
    }
    const targetId = isEdit ? investor!.id : result.id;
    router.push(`/${locale}/admin/crm/${targetId}`);
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <h1 className="text-2xl font-bold text-rp-navy">{isEdit ? t('editTitle') : t('newTitle')}</h1>

      {/* Identity */}
      <Section title={t('secIdentity')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={`${t('firstName')} *`}>
            <input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} className={inputCls} />
          </Field>
          <Field label={`${t('lastName')} *`}>
            <input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('company')}>
            <input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('jobTitle')}>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="mt-4">
          <label className={labelCls}>{t('photo')}</label>
          <div className="flex items-center gap-3">
            <CrmAvatar
              firstName={form.first_name || '?'}
              lastName={form.last_name || ''}
              photoUrl={form.photo_url || null}
              size={48}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePhoto(f);
              }}
              className="text-sm text-rp-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-rp-gray-100 file:text-rp-navy file:text-sm file:font-medium hover:file:bg-rp-gray-200"
            />
            {photoUploading && <span className="text-xs text-rp-gray-400">{t('uploading')}</span>}
          </div>
        </div>
      </Section>

      {/* Contact */}
      <Section title={t('secContact')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('email')}>
            <input value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('phone')}>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('whatsapp')}>
            <input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('linkedin')}>
            <input value={form.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('preferredContact')}>
            <select
              value={form.preferred_contact_method}
              onChange={(e) => set('preferred_contact_method', e.target.value)}
              className={inputCls}
            >
              {CONTACT_METHODS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Field label={t('addressLine1')}>
            <input value={form.address_line1} onChange={(e) => set('address_line1', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('addressLine2')}>
            <input value={form.address_line2} onChange={(e) => set('address_line2', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('city')}>
            <input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t('state')}>
              <input value={form.state} onChange={(e) => set('state', e.target.value)} className={inputCls} />
            </Field>
            <Field label={t('zip')}>
              <input value={form.zip} onChange={(e) => set('zip', e.target.value)} className={inputCls} />
            </Field>
            <Field label={t('country')}>
              <input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>
      </Section>

      {/* Classification */}
      <Section title={t('secClassification')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('status')}>
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('fieldEntityType')}>
            <input value={form.entity_type} onChange={(e) => set('entity_type', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('fieldSource')}>
            <input value={form.source} onChange={(e) => set('source', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('fieldReferredBy')}>
            <input value={form.referred_by} onChange={(e) => set('referred_by', e.target.value)} className={inputCls} />
          </Field>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-rp-gray-700">
          <input
            type="checkbox"
            checked={form.is_accredited}
            onChange={(e) => set('is_accredited', e.target.checked)}
            className="accent-rp-gold"
          />
          {t('accredited')}
        </label>
      </Section>

      {/* Capital */}
      <Section title={t('secCapital')}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label={`${t('equityReady')} ($)`}>
            <input type="number" value={form.equity_ready} onChange={(e) => set('equity_ready', e.target.value)} className={inputCls} />
          </Field>
          <Field label={`${t('equityCommitted')} ($)`}>
            <input type="number" value={form.equity_committed} onChange={(e) => set('equity_committed', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('equityTimeline')}>
            <input value={form.equity_timeline} onChange={(e) => set('equity_timeline', e.target.value)} className={inputCls} />
          </Field>
        </div>
      </Section>

      {/* Investment Preferences */}
      <Section title={t('secPreferences')}>
        <Field label={t('prefPropertyTypes')}>
          <div className="flex flex-wrap gap-2 mt-1">
            {PROPERTY_TYPES.map((p) => (
              <CheckChip
                key={p.value}
                label={p.label}
                active={propertyTypes.includes(p.value)}
                onClick={() => toggle(propertyTypes, setPropertyTypes, p.value)}
              />
            ))}
          </div>
        </Field>
        <div className="mt-4">
          <Field label={t('prefMarkets')}>
            <div className="flex flex-wrap gap-2 mt-1">
              {MARKETS.map((m) => (
                <CheckChip
                  key={m}
                  label={m}
                  active={markets.includes(m)}
                  onClick={() => toggle(markets, setMarkets, m)}
                />
              ))}
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <Field label={`${t('minCheck')} ($)`}>
            <input type="number" value={minCheck} onChange={(e) => setMinCheck(e.target.value)} className={inputCls} />
          </Field>
          <Field label={`${t('maxCheck')} ($)`}>
            <input type="number" value={maxCheck} onChange={(e) => setMaxCheck(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('preferredReturnRate')}>
            <input type="number" value={returnRate} onChange={(e) => setReturnRate(e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('prefPriority')}>
            <select value={priority} onChange={(e) => setPriority(e.target.value as CrmInvestmentPriority | '')} className={inputCls}>
              <option value="">{t('notSpecified')}</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('holdPeriod')}>
            <input value={holdPeriod} onChange={(e) => setHoldPeriod(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label={t('prefStructure')}>
            <div className="flex flex-wrap gap-2 mt-1">
              {STRUCTURE_PREFERENCES.map((s) => (
                <CheckChip
                  key={s.value}
                  label={s.label}
                  active={structures.includes(s.value)}
                  onClick={() => toggle(structures, setStructures, s.value)}
                />
              ))}
            </div>
          </Field>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-rp-gray-700">
          <input
            type="checkbox"
            checked={acceptsMezz}
            onChange={(e) => setAcceptsMezz(e.target.checked)}
            className="accent-rp-gold"
          />
          {t('acceptsSellerMezz')}
        </label>
      </Section>

      {/* Internal notes */}
      <Section title={t('internalNotes')}>
        <textarea
          value={form.internal_notes}
          onChange={(e) => set('internal_notes', e.target.value)}
          rows={3}
          className={inputCls}
        />
      </Section>

      {error && <p className="text-sm text-rp-red">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => router.push(isEdit ? `/${locale}/admin/crm/${investor!.id}` : `/${locale}/admin/crm`)}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg border border-rp-gray-200 text-sm font-medium text-rp-gray-600 hover:bg-rp-gray-100"
        >
          {t('cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}

function CheckChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-rp-gold-bg text-rp-gold border-rp-gold/40'
          : 'bg-white text-rp-gray-600 border-rp-gray-200 hover:border-rp-gold/40'
      }`}
    >
      {label}
    </button>
  );
}
