'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  COUNTRIES,
  Country,
  findCountryByIso,
  formatAsYouType,
  getPlaceholderForCountry,
  parseE164,
  toValidE164,
} from '@/lib/countries';

interface Props {
  open: boolean;
  initialE164?: string;
  submitting?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmingLabel?: string;
  confirmTone?: 'gold' | 'danger';
  onCancel: () => void;
  onConfirm: (e164: string) => void;
}

export default function PhoneConfirmModal({
  open,
  initialE164,
  submitting = false,
  error,
  title = 'Confirm your phone number',
  description = 'Our team will use this number to contact you about wire instructions and next steps. Your number will be saved to your profile.',
  confirmLabel = 'Confirm & commit',
  confirmingLabel = 'Confirming…',
  confirmTone = 'gold',
  onCancel,
  onConfirm,
}: Props) {
  const [country, setCountry] = useState<Country>(findCountryByIso('US')!);
  const [national, setNational] = useState('');
  const [touched, setTouched] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialE164) {
      const parsed = parseE164(initialE164);
      setCountry(parsed.country);
      setNational(parsed.national);
    } else {
      setCountry(findCountryByIso('US')!);
      setNational('');
    }
    setTouched(false);
    setPickerOpen(false);
    setQuery('');
  }, [open, initialE164]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const digits = national;
  const displayValue = useMemo(() => formatAsYouType(digits, country.iso), [digits, country.iso]);
  const placeholder = useMemo(() => getPlaceholderForCountry(country.iso), [country.iso]);
  const e164 = useMemo(() => toValidE164(digits, country.iso), [digits, country.iso]);
  const isValid = !!e164;

  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.dial.includes(q.replace(/^\+/, '')),
    );
  }, [query]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const newDigits = raw.replace(/\D/g, '');
    // If the user backspaced over a formatting char (length shrank but digit count
    // didn't change), also drop the last digit so backspace feels responsive.
    if (raw.length < displayValue.length && newDigits.length === digits.length) {
      setNational(newDigits.slice(0, -1));
    } else {
      setNational(newDigits);
    }
  };

  const handleSubmit = () => {
    setTouched(true);
    if (!e164) return;
    onConfirm(e164);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E3470]/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_24px_80px_rgba(14,52,112,0.25)]">
        <div className="px-6 pt-6 pb-4">
          <h3 className="font-[family-name:var(--font-playfair)] text-[22px] font-semibold text-[#0E3470]">
            {title}
          </h3>
          <p className="text-[13px] text-[#6B7280] mt-2 leading-[1.6]">
            {description}
          </p>
        </div>

        <div className="px-6 pb-5">
          <label className="block text-[11px] font-semibold tracking-[1.5px] uppercase text-[#BC9C45] mb-2">
            Phone number
          </label>
          <div className="relative flex gap-2" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              disabled={submitting}
              className="h-[48px] px-3 shrink-0 rounded-xl border border-[#EEF0F4] bg-white hover:bg-[#F9FAFB] inline-flex items-center gap-2 text-[13px] font-medium text-[#0F1B2D] transition-colors disabled:opacity-50"
            >
              <span className="inline-flex items-center justify-center h-5 px-1.5 rounded bg-[#F3F4F6] text-[10px] font-bold tracking-wide text-[#374151]">
                {country.iso}
              </span>
              <span className="tabular-nums leading-none">+{country.dial}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={displayValue}
              onChange={handleChange}
              onBlur={() => setTouched(true)}
              disabled={submitting}
              placeholder={placeholder}
              className={`flex-1 min-w-0 h-[48px] px-4 rounded-xl border bg-white text-[14px] text-[#0F1B2D] tabular-nums focus:outline-none transition-colors disabled:opacity-50 ${
                touched && !isValid
                  ? 'border-[#DC2626] focus:border-[#DC2626]'
                  : 'border-[#EEF0F4] focus:border-[#BC9C45]'
              }`}
            />

            {pickerOpen && (
              <div className="absolute left-0 right-0 sm:right-auto top-[52px] z-20 sm:w-[320px] max-h-[340px] bg-white rounded-xl border border-[#EEF0F4] shadow-[0_16px_48px_rgba(14,52,112,0.18)] overflow-hidden flex flex-col">
                <div className="p-2 border-b border-[#EEF0F4]">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search country or code"
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#EEF0F4] focus:outline-none focus:border-[#BC9C45]"
                  />
                </div>
                <ul className="flex-1 overflow-y-auto py-1">
                  {filteredCountries.length === 0 ? (
                    <li className="px-3 py-3 text-[12px] text-[#9CA3AF]">No match</li>
                  ) : (
                    filteredCountries.map((c) => (
                      <li key={c.iso}>
                        <button
                          type="button"
                          onClick={() => {
                            setCountry(c);
                            setPickerOpen(false);
                            setQuery('');
                          }}
                          className={`w-full inline-flex items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-[#F9FAFB] ${c.iso === country.iso ? 'bg-[#FDF8ED]' : ''}`}
                        >
                          <span className="inline-flex items-center justify-center w-9 h-5 rounded bg-[#F3F4F6] text-[10px] font-bold tracking-wide text-[#374151] shrink-0">
                            {c.iso}
                          </span>
                          <span className="flex-1 text-[#0F1B2D] truncate">{c.name}</span>
                          <span className="text-[#6B7280] tabular-nums shrink-0">+{c.dial}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          {touched && !isValid && (
            <p className="text-[12px] text-[#DC2626] mt-2">
              {digits.length === 0
                ? 'Enter your phone number.'
                : `That doesn't look like a valid ${country.name} number.`}
            </p>
          )}
          {isValid && e164 && (
            <p className="text-[12px] text-[#6B7280] mt-2 tabular-nums">
              Full number: {e164}
            </p>
          )}
          {error && (
            <p className="text-[12px] text-[#DC2626] mt-2">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#EEF0F4] rounded-b-2xl flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-[#6B7280] hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !isValid}
            className={
              confirmTone === 'danger'
                ? 'px-6 py-2.5 rounded-xl bg-[#DC2626] text-white text-[13px] font-bold shadow-[0_4px_16px_rgba(220,38,38,0.25)] hover:bg-[#B91C1C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                : 'px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[13px] font-bold shadow-[0_4px_16px_rgba(188,156,69,0.3)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed'
            }
          >
            {submitting ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
