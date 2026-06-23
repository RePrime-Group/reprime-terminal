'use client';

import { useTranslations } from 'next-intl';
import type { CrmContactMethod, CrmInvestingAs, CrmOwnershipPref } from '@/lib/types/database';
import {
  CONTACT_METHODS,
  INVESTING_AS_OPTIONS,
  CAPITAL_READY_BUCKETS,
  OWNERSHIP_PREFS,
  TIMELINE_OPTIONS,
} from '@/components/admin/crm/CrmConstants';

export interface CriteriaIdentityValue {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  company_name: string;
  title: string;
  preferred_contact_method: CrmContactMethod;
  investing_as: CrmInvestingAs | '';
  capital_ready: string;
  ownership_pref: CrmOwnershipPref | '';
  timeline_to_deploy: string;
  is_accredited: boolean;
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg text-rp-navy text-sm bg-white border border-rp-gray-300 placeholder:text-rp-gray-400 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors';
const lockedInputCls =
  'w-full px-3.5 py-2.5 rounded-lg text-rp-gray-600 text-sm cursor-not-allowed bg-rp-gray-100/60 border border-rp-gray-200';
const labelCls = 'block text-[11px] font-semibold text-rp-gray-500 uppercase tracking-wider mb-1.5';

interface Props {
  value: CriteriaIdentityValue;
  onChange: (v: CriteriaIdentityValue) => void;
}

export default function CriteriaIdentityFields({ value, onChange }: Props) {
  const t = useTranslations('criteria.fields');
  const set = <K extends keyof CriteriaIdentityValue>(k: K, v: CriteriaIdentityValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t('firstName')} *</label>
          <input
            type="text"
            value={value.first_name}
            onChange={(e) => set('first_name', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('lastName')} *</label>
          <input
            type="text"
            value={value.last_name}
            onChange={(e) => set('last_name', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('email')} (locked)</label>
        <input type="email" value={value.email} readOnly className={lockedInputCls} />
        <p className="text-[11px] text-rp-gray-400 mt-1">{t('emailHint')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t('phone')} *</label>
          <input
            type="tel"
            value={value.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('whatsapp')}</label>
          <input
            type="tel"
            value={value.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t('company')}</label>
          <input
            type="text"
            value={value.company_name}
            onChange={(e) => set('company_name', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{t('title')}</label>
          <input
            type="text"
            value={value.title}
            onChange={(e) => set('title', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('preferredContact')}</label>
        <select
          value={value.preferred_contact_method}
          onChange={(e) => set('preferred_contact_method', e.target.value as CrmContactMethod)}
          className={inputCls}
        >
          {CONTACT_METHODS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t('investingAs')}</label>
          <select
            value={value.investing_as}
            onChange={(e) => set('investing_as', e.target.value as CrmInvestingAs | '')}
            className={inputCls}
          >
            <option value="">—</option>
            {INVESTING_AS_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('capitalReady')}</label>
          <select
            value={value.capital_ready}
            onChange={(e) => set('capital_ready', e.target.value)}
            className={inputCls}
          >
            <option value="">—</option>
            {CAPITAL_READY_BUCKETS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('ownershipPref')}</label>
          <select
            value={value.ownership_pref}
            onChange={(e) => set('ownership_pref', e.target.value as CrmOwnershipPref | '')}
            className={inputCls}
          >
            <option value="">—</option>
            {OWNERSHIP_PREFS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('timeline')}</label>
          <select
            value={value.timeline_to_deploy}
            onChange={(e) => set('timeline_to_deploy', e.target.value)}
            className={inputCls}
          >
            <option value="">—</option>
            {TIMELINE_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-rp-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={value.is_accredited}
          onChange={(e) => set('is_accredited', e.target.checked)}
          className="accent-rp-gold"
        />
        {t('accredited')}
      </label>
    </div>
  );
}
