'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MatchRequest } from '@/lib/portal/types';
import {
  PORTAL_LISTING_TYPES,
  PORTAL_PROPERTY_TYPES,
  US_STATES,
} from '@/lib/portal/vocabulary';

interface Props {
  value: MatchRequest;
  onChange: (next: MatchRequest) => void;
}

export default function CustomCriteriaForm({ value, onChange }: Props) {
  const t = useTranslations('admin.sourcing');

  const patch = useCallback(
    (next: Partial<MatchRequest>) => onChange({ ...value, ...next }),
    [value, onChange],
  );

  const toggleArrayValue = (
    field: 'states' | 'property_types' | 'listing_types',
    v: string,
  ) => {
    const current = new Set(value[field] ?? []);
    if (current.has(v)) current.delete(v);
    else current.add(v);
    const next = Array.from(current);
    patch({ [field]: next.length > 0 ? next : undefined } as Partial<MatchRequest>);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Money */}
      <Row label={t('cPrice')}>
        <NumInput
          placeholder={t('phMin')}
          value={value.min_price}
          onChange={(v) => patch({ min_price: v })}
          commas
        />
        <NumInput
          placeholder={t('phMax')}
          value={value.max_price}
          onChange={(v) => patch({ max_price: v })}
          commas
        />
      </Row>

      <Row label={t('cCap')}>
        <NumInput
          placeholder={t('phMin')}
          value={value.min_cap}
          onChange={(v) => patch({ min_cap: v })}
          step={0.01}
        />
        <NumInput
          placeholder={t('phMax')}
          value={value.max_cap}
          onChange={(v) => patch({ max_cap: v })}
          step={0.01}
        />
      </Row>

      <Row label={t('cOccupancy')}>
        <NumInput
          placeholder={t('phMin')}
          value={value.min_occupancy}
          onChange={(v) => patch({ min_occupancy: v })}
        />
        <NumInput
          placeholder={t('phMax')}
          value={value.max_occupancy}
          onChange={(v) => patch({ max_occupancy: v })}
        />
      </Row>

      <Row label={t('cSqft')}>
        <NumInput
          placeholder={t('phMin')}
          value={value.min_sqft}
          onChange={(v) => patch({ min_sqft: v })}
          commas
        />
        <NumInput
          placeholder={t('phMax')}
          value={value.max_sqft}
          onChange={(v) => patch({ max_sqft: v })}
          commas
        />
      </Row>

      <Row label={t('cPsf')}>
        <NumInput
          placeholder={t('phMax')}
          value={value.max_price_per_sf}
          onChange={(v) => patch({ max_price_per_sf: v })}
        />
      </Row>

      {/* Categorical */}
      <ChipGroup
        label={t('cPropertyTypes')}
        options={PORTAL_PROPERTY_TYPES}
        selected={value.property_types ?? []}
        onToggle={(v) => toggleArrayValue('property_types', v)}
      />

      <ChipGroup
        label={t('cListingTypes')}
        options={PORTAL_LISTING_TYPES}
        selected={value.listing_types ?? []}
        onToggle={(v) => toggleArrayValue('listing_types', v)}
      />

      <ChipGroup
        label={t('cStates')}
        options={US_STATES.map((s) => ({ value: s.code, label: s.code }))}
        selected={value.states ?? []}
        onToggle={(v) => toggleArrayValue('states', v)}
        compact
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-center gap-3">
      <label className="text-[12px] font-semibold text-rp-gray-600">{label}</label>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
  step,
  commas = false,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  step?: number;
  /** Display thousands separators as the user types (integer fields only). */
  commas?: boolean;
}) {
  // Commas mode keeps a string mirror so we can render formatted text in a
  // text input (number inputs reject non-numeric chars). Plain mode uses the
  // native number input and trusts the parent number directly.
  const [text, setText] = useState<string>(() => fmt(value, commas));

  // Re-sync from parent when the value is reset externally (Search button
  // doesn't clear today, but the form may grow that affordance later).
  useEffect(() => {
    const currentParsed = parse(text, commas);
    if (value !== currentParsed) {
      setText(fmt(value, commas));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (commas) {
    return (
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          const next = digits ? Number(digits).toLocaleString('en-US') : '';
          setText(next);
          onChange(digits ? Number(digits) : undefined);
        }}
        className="px-3 py-2 rounded-lg border border-rp-gray-200 bg-white text-sm text-rp-navy w-full max-w-[180px] focus:outline-none focus:border-rp-gold tabular-nums"
      />
    );
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      step={step ?? 1}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(undefined);
          return;
        }
        const n = Number(raw);
        onChange(Number.isFinite(n) ? n : undefined);
      }}
      className="px-3 py-2 rounded-lg border border-rp-gray-200 bg-white text-sm text-rp-navy w-full max-w-[180px] focus:outline-none focus:border-rp-gold tabular-nums"
    />
  );
}

function fmt(v: number | undefined, commas: boolean): string {
  if (v === undefined) return '';
  if (commas) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return String(v);
}

function parse(text: string, commas: boolean): number | undefined {
  if (text === '') return undefined;
  const cleaned = commas ? text.replace(/\D/g, '') : text;
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
  compact = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  compact?: boolean;
}) {
  const sel = new Set(selected);
  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] items-start gap-3">
      <label className="text-[12px] font-semibold text-rp-gray-600 md:pt-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const isOn = sel.has(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={`${
                compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-[12px]'
              } rounded-md border font-medium transition-colors ${
                isOn
                  ? 'bg-rp-navy text-white border-rp-navy'
                  : 'bg-white text-rp-gray-600 border-rp-gray-200 hover:border-rp-gold/40'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
