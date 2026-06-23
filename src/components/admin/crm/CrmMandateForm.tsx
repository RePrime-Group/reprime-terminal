'use client';

import type { CrmStrategy, CrmTenantCreditPref } from '@/lib/types/database';
import {
  PROPERTY_TYPES,
  MARKETS,
  STRATEGIES,
  STRUCTURE_PREFERENCES,
  LISTING_TYPES,
  PROPERTY_CLASSES,
  TENANT_CREDIT_PREFS,
} from './CrmConstants';
import type { MandateInput } from './mandate';

// Pure helpers + the MandateInput type live in ./mandate so server components
// can import them too. Re-exported here for callers that still target this
// module.
export { EMPTY_MANDATE, mandateRowToInput, validateMandate, type MandateInput } from './mandate';

export type MandateFormTheme = 'light' | 'dark';

interface Themed {
  input: string;
  label: string;
  chipActive: string;
  chipIdle: string;
  helperText: string;
}

const LIGHT: Themed = {
  input:
    'w-full px-3 py-2 border border-rp-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold outline-none',
  label: 'block text-[11px] font-semibold text-rp-gray-500 uppercase tracking-wider mb-1',
  chipActive: 'bg-rp-gold-bg text-rp-gold border-rp-gold/40',
  chipIdle: 'bg-white text-rp-gray-600 border-rp-gray-200 hover:border-rp-gold/40',
  helperText: 'text-[11px] text-rp-gray-400',
};

const DARK: Themed = {
  input:
    'w-full px-3 py-2.5 rounded-lg text-white text-sm focus:outline-none focus:border-[#D4A843]/40 transition-colors bg-white/[0.04] border border-white/[0.08] placeholder:text-white/25',
  label: 'block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1.5',
  chipActive: 'bg-[#BC9C45]/20 text-[#D4A843] border-[#BC9C45]/40',
  chipIdle: 'bg-white/[0.04] text-white/60 border-white/[0.08] hover:border-[#BC9C45]/30',
  helperText: 'text-[11px] text-white/30',
};

export interface CrmMandateFormProps {
  value: MandateInput;
  onChange: (next: MandateInput) => void;
  theme?: MandateFormTheme;
  /** Show the label field (admin: yes; criteria public form: optional). */
  showLabelField?: boolean;
}

export default function CrmMandateForm({
  value,
  onChange,
  theme = 'light',
  showLabelField = true,
}: CrmMandateFormProps) {
  const cls = theme === 'dark' ? DARK : LIGHT;

  const set = <K extends keyof MandateInput>(key: K, v: MandateInput[K]) =>
    onChange({ ...value, [key]: v });

  const toggleInList = (key: 'property_types' | 'listing_types' | 'states' | 'property_class' | 'structure_prefs', item: string) => {
    const arr = value[key];
    const next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
    set(key, next);
  };

  const numField = (v: number | null | undefined) => (v == null ? '' : String(v));
  const onNumChange = (key: keyof MandateInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      set(key, null as never);
      return;
    }
    const n = parseFloat(raw);
    set(key, (isNaN(n) ? null : n) as never);
  };

  // Price inputs: display with thousand-separator commas for readability,
  // store as a plain number. Commas are display-only — never sent to the API.
  const priceField = (v: number | null | undefined) =>
    v == null ? '' : v.toLocaleString('en-US');
  const onPriceChange = (key: keyof MandateInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    if (digits === '') {
      set(key, null as never);
      return;
    }
    const n = parseInt(digits, 10);
    set(key, (isNaN(n) ? null : n) as never);
  };

  return (
    <div className="flex flex-col gap-4">
      {showLabelField && (
        <Field label="Mandate Label" cls={cls}>
          <input
            type="text"
            value={value.label ?? ''}
            onChange={(e) => set('label', e.target.value)}
            placeholder='e.g. "Self-Storage — Midwest"'
            className={cls.input}
          />
        </Field>
      )}

      {/* Property types */}
      <Field label="Property Types *" cls={cls}>
        <ChipRow
          options={PROPERTY_TYPES}
          selected={value.property_types}
          onToggle={(v) => toggleInList('property_types', v)}
          cls={cls}
        />
      </Field>

      {/* Listing types */}
      <Field label="On / Off Market" cls={cls}>
        <ChipRow
          options={LISTING_TYPES}
          selected={value.listing_types}
          onToggle={(v) => toggleInList('listing_types', v)}
          cls={cls}
        />
      </Field>

      {/* Markets */}
      <Field label="Target Markets *" cls={cls}>
        <ChipRow
          options={MARKETS.map((m) => ({ value: m, label: m }))}
          selected={value.states}
          onToggle={(v) => toggleInList('states', v)}
          cls={cls}
        />
      </Field>

      {/* Price range */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price Minimum ($) *" cls={cls}>
          <input
            type="text"
            inputMode="numeric"
            value={priceField(value.min_price)}
            onChange={onPriceChange('min_price')}
            className={cls.input}
          />
        </Field>
        <Field label="Price Maximum ($) *" cls={cls}>
          <input
            type="text"
            inputMode="numeric"
            value={priceField(value.max_price)}
            onChange={onPriceChange('max_price')}
            className={cls.input}
          />
        </Field>
      </div>

      {/* Returns */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target Cap Rate Min (%)" cls={cls}>
          <input type="number" step="0.1" value={numField(value.min_cap)} onChange={onNumChange('min_cap')} className={cls.input} />
        </Field>
        <Field label="Target Cash-on-Cash Min (%)" cls={cls}>
          <input type="number" step="0.1" value={numField(value.min_coc)} onChange={onNumChange('min_coc')} className={cls.input} />
        </Field>
      </div>

      {/* Strategy */}
      <Field label="Strategy" cls={cls}>
        <select
          value={value.strategy ?? ''}
          onChange={(e) => set('strategy', (e.target.value || null) as CrmStrategy | null)}
          className={cls.input}
        >
          <option value="">— Not specified —</option>
          {STRATEGIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Occupancy range */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min Occupancy (%)" cls={cls}>
          <input type="number" step="1" value={numField(value.min_occupancy)} onChange={onNumChange('min_occupancy')} className={cls.input} />
        </Field>
        <Field label="Max Occupancy (%)" cls={cls}>
          <input type="number" step="1" value={numField(value.max_occupancy)} onChange={onNumChange('max_occupancy')} className={cls.input} />
        </Field>
      </div>
      <p className={cls.helperText}>
        Open to high-vacancy plays? Set Max Occupancy to e.g. 60 to surface 40%+ vacancy opportunities.
      </p>

      {/* Property class */}
      <Field label="Property Class" cls={cls}>
        <ChipRow
          options={PROPERTY_CLASSES}
          selected={value.property_class}
          onToggle={(v) => toggleInList('property_class', v)}
          cls={cls}
        />
      </Field>

      {/* Size */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min Square Footage" cls={cls}>
          <input type="number" value={numField(value.min_sqft)} onChange={onNumChange('min_sqft')} className={cls.input} />
        </Field>
        <Field label="Max Square Footage" cls={cls}>
          <input type="number" value={numField(value.max_sqft)} onChange={onNumChange('max_sqft')} className={cls.input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Price per SF Ceiling ($)" cls={cls}>
          <input
            type="text"
            inputMode="numeric"
            value={priceField(value.price_per_sf_max)}
            onChange={onPriceChange('price_per_sf_max')}
            className={cls.input}
          />
        </Field>
        <Field label="Min Lease Term (years)" cls={cls}>
          <input type="number" step="0.5" value={numField(value.min_lease_term_years)} onChange={onNumChange('min_lease_term_years')} className={cls.input} />
        </Field>
      </div>

      {/* Tenant credit */}
      <Field label="Tenant Credit" cls={cls}>
        <select
          value={value.tenant_credit_pref ?? ''}
          onChange={(e) => set('tenant_credit_pref', (e.target.value || null) as CrmTenantCreditPref | null)}
          className={cls.input}
        >
          <option value="">— Not specified —</option>
          {TENANT_CREDIT_PREFS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Structures */}
      <Field label="Open to Creative Structures" cls={cls}>
        <ChipRow
          options={STRUCTURE_PREFERENCES}
          selected={value.structure_prefs}
          onToggle={(v) => toggleInList('structure_prefs', v)}
          cls={cls}
        />
      </Field>

      {/* Notes */}
      <Field label="Ideal Deal (free text)" cls={cls}>
        <textarea
          value={value.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="What are they really after? Any color we should know."
          className={cls.input}
        />
      </Field>
    </div>
  );
}

function Field({ label, cls, children }: { label: string; cls: Themed; children: React.ReactNode }) {
  return (
    <div>
      <label className={cls.label}>{label}</label>
      {children}
    </div>
  );
}

function ChipRow({
  options,
  selected,
  onToggle,
  cls,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  cls: Themed;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              on ? cls.chipActive : cls.chipIdle
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

