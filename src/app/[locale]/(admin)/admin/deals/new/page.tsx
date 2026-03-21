'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import type { DealStatus } from '@/lib/types/database';

const PROPERTY_TYPES = [
  'Office',
  'Retail',
  'Industrial',
  'Multifamily',
  'Mixed-Use',
  'Hospitality',
  'Medical',
  'Other',
] as const;

const CLASS_TYPES = ['A', 'B', 'C'] as const;

interface DealFormData {
  name: string;
  property_type: string;
  city: string;
  state: string;
  square_footage: string;
  units: string;
  class_type: string;
  year_built: string;
  occupancy: string;
  purchase_price: string;
  noi: string;
  cap_rate: string;
  irr: string;
  coc: string;
  dscr: string;
  equity_required: string;
  loan_estimate: string;
  seller_financing: boolean;
  special_terms: string;
  assignment_fee: string;
  assignment_irr: string;
  gplp_irr: string;
  acq_fee: string;
  asset_mgmt_fee: string;
  gp_carry: string;
  loan_fee: string;
  dd_deadline: string;
  close_deadline: string;
  extension_deadline: string;
  psa_draft_start: string;
  loi_signed_at: string;
  teaser_description: string;
  neighborhood: string;
  metro_population: string;
  job_growth: string;
  quarter_release: string;
  investment_highlights: string[];
  acquisition_thesis: string;
}

const initialFormData: DealFormData = {
  name: '',
  property_type: '',
  city: '',
  state: '',
  square_footage: '',
  units: '',
  class_type: '',
  year_built: '',
  occupancy: '',
  purchase_price: '',
  noi: '',
  cap_rate: '',
  irr: '',
  coc: '',
  dscr: '',
  equity_required: '',
  loan_estimate: '',
  seller_financing: false,
  special_terms: '',
  assignment_fee: '3%',
  assignment_irr: '',
  gplp_irr: '',
  acq_fee: '1%',
  asset_mgmt_fee: '2%',
  gp_carry: '20% above 8% pref',
  loan_fee: '1 point',
  dd_deadline: '',
  close_deadline: '',
  extension_deadline: '',
  psa_draft_start: '',
  loi_signed_at: '',
  teaser_description: '',
  neighborhood: '',
  metro_population: '',
  job_growth: '',
  quarter_release: '',
  investment_highlights: [''],
  acquisition_thesis: '',
};

interface FormErrors {
  name?: string;
  city?: string;
  state?: string;
  property_type?: string;
  purchase_price?: string;
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  error?: string;
  className?: string;
}) {
  const inputId = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="block text-[13px] font-medium text-rp-gray-700 mb-1.5"
      >
        {label}
      </label>
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3.5 py-2.5 border rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold placeholder:text-rp-gray-400 transition-colors bg-white ${
          error ? 'border-rp-red' : 'border-rp-gray-300'
        }`}
      >
        <option value="">{placeholder ?? `Select ${label}`}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-rp-red">{error}</p>}
    </div>
  );
}

export default function NewDealPage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const router = useRouter();
  const [form, setForm] = useState<DealFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const updateField = <K extends keyof DealFormData>(
    key: K,
    value: DealFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const addHighlight = () => {
    setForm((prev) => ({
      ...prev,
      investment_highlights: [...prev.investment_highlights, ''],
    }));
  };

  const updateHighlight = (index: number, value: string) => {
    setForm((prev) => {
      const updated = [...prev.investment_highlights];
      updated[index] = value;
      return { ...prev, investment_highlights: updated };
    });
  };

  const removeHighlight = (index: number) => {
    setForm((prev) => ({
      ...prev,
      investment_highlights: prev.investment_highlights.filter(
        (_, i) => i !== index
      ),
    }));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.state.trim()) newErrors.state = 'State is required';
    if (!form.property_type) newErrors.property_type = 'Property type is required';
    if (!form.purchase_price.trim())
      newErrors.purchase_price = 'Purchase price is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (status: DealStatus) => {
    if (!validate()) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const highlights = form.investment_highlights.filter(
        (h) => h.trim() !== ''
      );

      const { error } = await supabase.from('terminal_deals').insert({
        name: form.name.trim(),
        property_type: form.property_type,
        city: form.city.trim(),
        state: form.state.trim(),
        square_footage: form.square_footage || null,
        units: form.units || null,
        class_type: form.class_type || null,
        year_built: form.year_built ? parseInt(form.year_built, 10) : null,
        occupancy: form.occupancy || null,
        purchase_price: form.purchase_price.trim(),
        noi: form.noi || null,
        cap_rate: form.cap_rate || null,
        irr: form.irr || null,
        coc: form.coc || null,
        dscr: form.dscr || null,
        equity_required: form.equity_required || null,
        loan_estimate: form.loan_estimate || null,
        seller_financing: form.seller_financing,
        special_terms: form.special_terms,
        assignment_fee: form.assignment_fee,
        assignment_irr: form.assignment_irr || null,
        gplp_irr: form.gplp_irr || null,
        acq_fee: form.acq_fee,
        asset_mgmt_fee: form.asset_mgmt_fee,
        gp_carry: form.gp_carry,
        loan_fee: form.loan_fee,
        dd_deadline: form.dd_deadline || null,
        close_deadline: form.close_deadline || null,
        extension_deadline: form.extension_deadline || null,
        psa_draft_start: form.psa_draft_start || null,
        loi_signed_at: form.loi_signed_at || null,
        teaser_description: form.teaser_description || null,
        neighborhood: form.neighborhood || null,
        metro_population: form.metro_population || null,
        job_growth: form.job_growth || null,
        quarter_release: form.quarter_release || null,
        investment_highlights: highlights.length > 0 ? highlights : null,
        acquisition_thesis: form.acquisition_thesis || null,
        status,
        created_by: user?.id ?? null,
      });

      if (error) {
        console.error('Failed to create deal:', error);
        alert('Failed to create deal. Please try again.');
        return;
      }

      router.push(`/${locale}/admin/deals`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl font-[family-name:var(--font-poppins)]">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/${locale}/admin/deals`}
          className="inline-flex items-center gap-1.5 text-sm text-rp-gray-500 hover:text-rp-navy transition-colors mb-3"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          Deals
        </Link>
        <h1 className="text-[24px] font-bold text-rp-navy">New Deal</h1>
      </div>

      {/* Section 1: Basic Information */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">
          Basic Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            error={errors.name}
            placeholder="Deal name"
          />
          <SelectField
            label="Property Type *"
            value={form.property_type}
            onChange={(v) => updateField('property_type', v)}
            options={PROPERTY_TYPES}
            error={errors.property_type}
          />
          <Input
            label="City *"
            value={form.city}
            onChange={(e) => updateField('city', e.target.value)}
            error={errors.city}
            placeholder="City"
          />
          <Input
            label="State *"
            value={form.state}
            onChange={(e) => updateField('state', e.target.value)}
            error={errors.state}
            placeholder="State"
          />
          <Input
            label="Square Footage"
            value={form.square_footage}
            onChange={(e) => updateField('square_footage', e.target.value)}
            placeholder="e.g. 50,000"
          />
          <Input
            label="Units"
            value={form.units}
            onChange={(e) => updateField('units', e.target.value)}
            placeholder="e.g. 120"
          />
          <SelectField
            label="Class Type"
            value={form.class_type}
            onChange={(v) => updateField('class_type', v)}
            options={CLASS_TYPES}
          />
          <Input
            label="Year Built"
            value={form.year_built}
            onChange={(e) => updateField('year_built', e.target.value)}
            placeholder="e.g. 2005"
            type="number"
          />
          <Input
            label="Occupancy %"
            value={form.occupancy}
            onChange={(e) => updateField('occupancy', e.target.value)}
            placeholder="e.g. 95%"
          />
        </div>
      </div>

      {/* Section 2: Financial Metrics */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">
          Financial Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Purchase Price *"
            value={form.purchase_price}
            onChange={(e) => updateField('purchase_price', e.target.value)}
            error={errors.purchase_price}
            placeholder="e.g. 12,500,000"
          />
          <Input
            label="NOI"
            value={form.noi}
            onChange={(e) => updateField('noi', e.target.value)}
            placeholder="e.g. 850,000"
          />
          <Input
            label="Cap Rate"
            value={form.cap_rate}
            onChange={(e) => updateField('cap_rate', e.target.value)}
            placeholder="e.g. 6.8%"
          />
          <Input
            label="IRR"
            value={form.irr}
            onChange={(e) => updateField('irr', e.target.value)}
            placeholder="e.g. 18%"
          />
          <Input
            label="CoC"
            value={form.coc}
            onChange={(e) => updateField('coc', e.target.value)}
            placeholder="e.g. 8.5%"
          />
          <Input
            label="DSCR"
            value={form.dscr}
            onChange={(e) => updateField('dscr', e.target.value)}
            placeholder="e.g. 1.25"
          />
          <Input
            label="Equity Required"
            value={form.equity_required}
            onChange={(e) => updateField('equity_required', e.target.value)}
            placeholder="e.g. 4,500,000"
          />
          <Input
            label="Loan Estimate"
            value={form.loan_estimate}
            onChange={(e) => updateField('loan_estimate', e.target.value)}
            placeholder="e.g. 8,000,000"
          />
        </div>
      </div>

      {/* Section 3: Deal Terms */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">
          Deal Terms
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 col-span-full">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.seller_financing}
                onChange={(e) =>
                  updateField('seller_financing', e.target.checked)
                }
                className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold/20"
              />
              <span className="text-[13px] font-medium text-rp-gray-700">
                Seller Financing Available
              </span>
            </label>
          </div>
          <Input
            label="Special Terms"
            value={form.special_terms}
            onChange={(e) => updateField('special_terms', e.target.value)}
            placeholder="Any special deal terms"
            className="col-span-full"
          />
          <Input
            label="Assignment Fee"
            value={form.assignment_fee}
            onChange={(e) => updateField('assignment_fee', e.target.value)}
            placeholder="3%"
          />
          <Input
            label="Assignment IRR"
            value={form.assignment_irr}
            onChange={(e) => updateField('assignment_irr', e.target.value)}
            placeholder="e.g. 22%"
          />
          <Input
            label="GP/LP IRR"
            value={form.gplp_irr}
            onChange={(e) => updateField('gplp_irr', e.target.value)}
            placeholder="e.g. 15% / 12%"
          />
          <Input
            label="Acquisition Fee"
            value={form.acq_fee}
            onChange={(e) => updateField('acq_fee', e.target.value)}
            placeholder="1%"
          />
          <Input
            label="Asset Mgmt Fee"
            value={form.asset_mgmt_fee}
            onChange={(e) => updateField('asset_mgmt_fee', e.target.value)}
            placeholder="2%"
          />
          <Input
            label="GP Carry"
            value={form.gp_carry}
            onChange={(e) => updateField('gp_carry', e.target.value)}
            placeholder="20% above 8% pref"
          />
          <Input
            label="Loan Fee"
            value={form.loan_fee}
            onChange={(e) => updateField('loan_fee', e.target.value)}
            placeholder="1 point"
          />
        </div>
      </div>

      {/* Section 4: Pre-Pipeline / Coming Soon */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">
          Pre-Pipeline
        </h2>
        <div className="mb-4">
          <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
            Teaser Description
          </label>
          <textarea
            value={form.teaser_description}
            onChange={(e) => updateField('teaser_description', e.target.value)}
            rows={3}
            placeholder="Short description shown to investors on Coming Soon cards..."
            className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold placeholder:text-rp-gray-400 transition-all duration-200 resize-vertical"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="LOI Signed Date"
            type="datetime-local"
            value={form.loi_signed_at}
            onChange={(e) => updateField('loi_signed_at', e.target.value)}
          />
          <Input
            label="PSA Draft Start"
            type="datetime-local"
            value={form.psa_draft_start}
            onChange={(e) => updateField('psa_draft_start', e.target.value)}
          />
        </div>
        <p className="text-[11px] text-rp-gray-400 mt-2">
          PSA countdown shows 7 days from draft start to DD. LOI date is displayed on the investor card.
        </p>
      </div>

      {/* Section 5: Timeline */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">
          Timeline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="DD Deadline"
            type="datetime-local"
            value={form.dd_deadline}
            onChange={(e) => updateField('dd_deadline', e.target.value)}
          />
          <Input
            label="Close Deadline"
            type="datetime-local"
            value={form.close_deadline}
            onChange={(e) => updateField('close_deadline', e.target.value)}
          />
          <Input
            label="Extension Deadline"
            type="datetime-local"
            value={form.extension_deadline}
            onChange={(e) => updateField('extension_deadline', e.target.value)}
          />
        </div>
      </div>

      {/* Section 5: Market Context */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">
          Market Context
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Neighborhood"
            value={form.neighborhood}
            onChange={(e) => updateField('neighborhood', e.target.value)}
            placeholder="e.g. Midtown"
          />
          <Input
            label="Metro Population"
            value={form.metro_population}
            onChange={(e) => updateField('metro_population', e.target.value)}
            placeholder="e.g. 1,200,000"
          />
          <Input
            label="Job Growth"
            value={form.job_growth}
            onChange={(e) => updateField('job_growth', e.target.value)}
            placeholder="e.g. 3.2%"
          />
          <Input
            label="Quarter Release"
            value={form.quarter_release}
            onChange={(e) => updateField('quarter_release', e.target.value)}
            placeholder="e.g. Q1 2026"
          />
        </div>
      </div>

      {/* Section 6: Investment Thesis */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">
          Investment Thesis
        </h2>

        {/* Highlights */}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-rp-gray-700 mb-2">
            Investment Highlights
          </label>
          <div className="flex flex-col gap-2">
            {form.investment_highlights.map((highlight, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={highlight}
                  onChange={(e) => updateHighlight(index, e.target.value)}
                  placeholder={`Highlight ${index + 1}`}
                  className="flex-1"
                />
                {form.investment_highlights.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeHighlight(index)}
                    className="p-2 text-rp-gray-400 hover:text-rp-red transition-colors rounded-lg hover:bg-rp-gray-100"
                    aria-label="Remove highlight"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <path d="M4 8h8" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addHighlight}
            className="mt-2 text-sm text-rp-gold hover:text-rp-gold/80 font-medium transition-colors"
          >
            + Add Highlight
          </button>
        </div>

        {/* Acquisition Thesis */}
        <div>
          <label
            htmlFor="acquisition-thesis"
            className="block text-[13px] font-medium text-rp-gray-700 mb-1.5"
          >
            Acquisition Thesis
          </label>
          <textarea
            id="acquisition-thesis"
            value={form.acquisition_thesis}
            onChange={(e) => updateField('acquisition_thesis', e.target.value)}
            rows={5}
            placeholder="Describe the investment thesis..."
            className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold placeholder:text-rp-gray-400 transition-colors resize-vertical"
          />
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button
          variant="secondary"
          onClick={() => handleSubmit('draft')}
          loading={saving}
        >
          Save as Draft
        </Button>
        <Button
          variant="subscribe"
          onClick={() => handleSubmit('coming_soon')}
          loading={saving}
        >
          Save as Coming Soon
        </Button>
        <Button
          variant="gold"
          onClick={() => handleSubmit('published')}
          loading={saving}
        >
          Save &amp; Publish
        </Button>
      </div>
    </div>
  );
}
