'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { parseDealInputs, calculateDeal } from '@/lib/utils/deal-calculator';
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
  // Senior Debt
  ltv: string;
  interest_rate: string;
  amortization_years: string;
  loan_fee_points: string;
  io_period_months: string;
  // Mezzanine
  mezz_percent: string;
  mezz_rate: string;
  mezz_term_months: string;
  // Credits
  seller_credit: string;
  pref_return: string;
  // Exit
  hold_period_years: string;
  exit_cap_rate: string;
  debt_terms_quoted: boolean;
  dd_deadline: string;
  close_deadline: string;
  extension_deadline: string;
  psa_draft_start: string;
  loi_signed_at: string;
  teaser_description: string;
  deposit_amount: string;
  deposit_held_by: string;
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
  ltv: '75',
  interest_rate: '6.00',
  amortization_years: '30',
  loan_fee_points: '1',
  io_period_months: '0',
  mezz_percent: '15',
  mezz_rate: '5.00',
  mezz_term_months: '60',
  seller_credit: '0',
  pref_return: '8',
  hold_period_years: '5',
  exit_cap_rate: '',
  debt_terms_quoted: false,
  dd_deadline: '',
  close_deadline: '',
  extension_deadline: '',
  psa_draft_start: '',
  loi_signed_at: '',
  teaser_description: '',
  deposit_amount: '',
  deposit_held_by: '',
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
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotes, setAiNotes] = useState<string | null>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const [isPortfolio, setIsPortfolio] = useState(false);
  const [portfolioAddresses, setPortfolioAddresses] = useState<{ label: string; address: string; city: string; state: string; sf: string; units: string }[]>([]);

  const handleAIExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAiExtracting(true);
    setAiError(null);
    setAiNotes(null);

    try {
      // Upload files to Supabase storage first (avoids Vercel body size limit)
      const supabase = createClient();
      const storagePaths: { name: string; path: string }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `_temp/extract/${Date.now()}-${i}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('terminal-dd-documents')
          .upload(path, file);

        if (uploadErr) {
          setAiError(`Upload failed for ${file.name}: ${uploadErr.message}`);
          return;
        }
        storagePaths.push({ name: file.name, path });
      }

      const res = await fetch('/api/deals/extract-from-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePaths }),
      });

      const result = await res.json();

      if (!res.ok) {
        setAiError(result.error || 'Extraction failed');
        return;
      }

      const d = result.data;

      // Auto-fill the form with extracted data
      setForm((prev) => ({
        ...prev,
        name: d.name || prev.name,
        city: d.city || prev.city,
        state: d.state || prev.state,
        property_type: d.property_type || prev.property_type,
        square_footage: d.square_footage || prev.square_footage,
        units: d.units || prev.units,
        class_type: d.class_type || prev.class_type,
        year_built: d.year_built?.toString() || prev.year_built,
        occupancy: d.occupancy || prev.occupancy,
        purchase_price: d.purchase_price || prev.purchase_price,
        noi: d.noi || prev.noi,
        cap_rate: d.cap_rate || prev.cap_rate,
        irr: d.irr || prev.irr,
        coc: d.coc || prev.coc,
        dscr: d.dscr || prev.dscr,
        equity_required: d.equity_required || prev.equity_required,
        loan_estimate: d.loan_estimate || prev.loan_estimate,
        seller_financing: d.seller_financing ?? prev.seller_financing,
        special_terms: d.special_terms || prev.special_terms,
        deposit_amount: d.deposit_amount || prev.deposit_amount,
        deposit_held_by: d.deposit_held_by || prev.deposit_held_by,
        neighborhood: d.neighborhood || prev.neighborhood,
        metro_population: d.metro_population || prev.metro_population,
        job_growth: d.job_growth || prev.job_growth,
        investment_highlights: d.investment_highlights?.length > 0 ? d.investment_highlights : prev.investment_highlights,
        acquisition_thesis: d.acquisition_thesis || prev.acquisition_thesis,
        assignment_fee: d.assignment_fee || prev.assignment_fee,
        assignment_irr: d.assignment_irr || prev.assignment_irr,
        acq_fee: d.acq_fee || prev.acq_fee,
        asset_mgmt_fee: d.asset_mgmt_fee || prev.asset_mgmt_fee,
        gp_carry: d.gp_carry || prev.gp_carry,
        loan_fee: d.loan_fee || prev.loan_fee,
        // Set DD and close deadlines from days
        dd_deadline: d.dd_deadline_days
          ? new Date(Date.now() + d.dd_deadline_days * 86400000).toISOString().slice(0, 16)
          : prev.dd_deadline,
        close_deadline: d.close_deadline_days
          ? new Date(Date.now() + d.close_deadline_days * 86400000).toISOString().slice(0, 16)
          : prev.close_deadline,
      }));

      // Handle portfolio addresses from AI
      if (d.addresses && d.addresses.length > 0) {
        setIsPortfolio(true);
        setPortfolioAddresses(d.addresses.map((a: { label?: string; address?: string; city?: string; state?: string; square_footage?: string; units?: string }) => ({
          label: a.label || '',
          address: a.address || '',
          city: a.city || '',
          state: a.state || '',
          sf: a.square_footage || '',
          units: a.units || '',
        })));
      }

      if (d.source_notes) {
        setAiNotes(d.source_notes);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setAiError(`Network error: ${msg}. If using large PDFs, this may be a timeout issue. Try uploading smaller files or check Vercel plan limits.`);
    } finally {
      setAiExtracting(false);
      if (aiFileRef.current) aiFileRef.current.value = '';
    }
  };

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

      const { data: newDeal, error } = await supabase.from('terminal_deals').insert({
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
        deposit_amount: form.deposit_amount || null,
        deposit_held_by: form.deposit_held_by || null,
        neighborhood: form.neighborhood || null,
        metro_population: form.metro_population || null,
        job_growth: form.job_growth || null,
        quarter_release: form.quarter_release || null,
        investment_highlights: highlights.length > 0 ? highlights : null,
        acquisition_thesis: form.acquisition_thesis || null,
        // Financial engine fields
        ltv: form.ltv || '75',
        interest_rate: form.interest_rate || '6.00',
        amortization_years: form.amortization_years || '30',
        loan_fee_points: form.loan_fee_points || '1',
        io_period_months: form.io_period_months || '0',
        mezz_percent: form.mezz_percent || '15',
        mezz_rate: form.mezz_rate || '5.00',
        mezz_term_months: form.mezz_term_months || '60',
        seller_credit: form.seller_credit || '0',
        pref_return: form.pref_return || '8',
        hold_period_years: form.hold_period_years || '5',
        exit_cap_rate: form.exit_cap_rate || null,
        debt_terms_quoted: form.debt_terms_quoted || false,
        status,
        created_by: user?.id ?? null,
      }).select('id').single();

      // Persist computed metrics
      if (newDeal) {
        const insertData: Record<string, unknown> = {
          purchase_price: form.purchase_price, noi: form.noi, ltv: form.ltv,
          interest_rate: form.interest_rate, amortization_years: form.amortization_years,
          loan_fee_points: form.loan_fee_points, seller_financing: form.seller_financing,
          mezz_percent: form.mezz_percent, mezz_rate: form.mezz_rate,
          mezz_term_months: form.mezz_term_months, seller_credit: form.seller_credit,
          assignment_fee: form.assignment_fee, acq_fee: form.acq_fee,
          asset_mgmt_fee: form.asset_mgmt_fee, gp_carry: form.gp_carry,
          pref_return: form.pref_return, hold_period_years: form.hold_period_years,
          exit_cap_rate: form.exit_cap_rate,
        };
        const ci = parseDealInputs(insertData);
        const cm = calculateDeal(ci);
        await supabase.from('terminal_deals').update({
          cap_rate: cm.capRate > 0 ? cm.capRate.toFixed(2) : null,
          irr: cm.irr !== null ? cm.irr.toFixed(2) : null,
          coc: cm.cocReturn !== 0 ? cm.cocReturn.toFixed(2) : null,
          dscr: cm.lenderDSCR > 0 ? cm.lenderDSCR.toFixed(2) : null,
          equity_required: cm.netEquity > 0 ? String(Math.round(cm.netEquity)) : null,
          loan_estimate: cm.loanAmount > 0 ? String(Math.round(cm.loanAmount)) : null,
        }).eq('id', newDeal.id);
      }

      if (error || !newDeal) {
        console.error('Failed to create deal:', error);
        alert('Failed to create deal. Please try again.');
        return;
      }

      // Create portfolio addresses if any
      if (isPortfolio && portfolioAddresses.length > 0) {
        const addressInserts = portfolioAddresses
          .filter((a) => a.label.trim())
          .map((a, i) => ({
            deal_id: newDeal.id,
            label: a.label.trim(),
            address: a.address.trim() || null,
            city: a.city.trim() || null,
            state: a.state.trim() || null,
            square_footage: a.sf.trim() || null,
            units: a.units.trim() || null,
            display_order: i,
          }));

        if (addressInserts.length > 0) {
          await supabase.from('terminal_deal_addresses').insert(addressInserts);
        }
      }

      router.push(`/${locale}/admin/deals/${newDeal.id}`);
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

      {/* AI Document Upload — Hero Section */}
      <div className="bg-gradient-to-br from-[#07090F] via-[#0A1628] to-[#0E3470] rounded-2xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(188,156,69,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(188,156,69,0.5) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#BC9C45]/20 flex items-center justify-center">
              <span className="text-[22px]">⚡</span>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-white font-[family-name:var(--font-playfair)]">
                AI Deal Creator
              </h2>
              <p className="text-[12px] text-white/40">
                Upload an OM and/or LOI — Claude will extract all deal fields automatically
              </p>
            </div>
          </div>

          <div
            onClick={() => !aiExtracting && aiFileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              aiExtracting
                ? 'border-[#BC9C45]/30 bg-[#BC9C45]/5'
                : 'border-white/15 hover:border-[#BC9C45]/40 hover:bg-white/[0.02]'
            }`}
          >
            <input
              ref={aiFileRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleAIExtract}
              className="hidden"
            />
            {aiExtracting ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-[#BC9C45] border-t-transparent rounded-full animate-spin" />
                <p className="text-[14px] font-medium text-white">AI is reading your documents...</p>
                <p className="text-[12px] text-white/40">Extracting property details, financials, and deal terms</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-3">
                  <div className="w-12 h-14 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-[#BC9C45]">OM</span>
                  </div>
                  <div className="w-12 h-14 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-white/50">LOI</span>
                  </div>
                </div>
                <p className="text-[14px] font-medium text-white">
                  Drop your OM and LOI here
                </p>
                <p className="text-[12px] text-white/40">
                  PDF files · OM = marketed terms · LOI = negotiated terms (takes priority)
                </p>
              </div>
            )}
          </div>

          {aiError && (
            <div className="mt-4 p-3 bg-[#DC2626]/10 border border-[#DC2626]/20 rounded-lg">
              <p className="text-[12px] text-[#DC2626] font-medium">{aiError}</p>
            </div>
          )}

          {aiNotes && (
            <div className="mt-4 p-3 bg-[#BC9C45]/10 border border-[#BC9C45]/20 rounded-lg">
              <p className="text-[10px] font-semibold text-[#BC9C45] uppercase tracking-[1.5px] mb-1">AI SOURCE NOTES</p>
              <p className="text-[12px] text-white/70 leading-relaxed">{aiNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Deal Type Toggle */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-semibold text-rp-navy">Deal Type</h2>
          <div className="bg-rp-gray-100 rounded-lg p-1 inline-flex">
            <button
              onClick={() => setIsPortfolio(false)}
              className={`px-4 py-2 text-[12px] font-semibold rounded-md transition-all ${
                !isPortfolio ? 'bg-rp-navy text-white' : 'text-rp-gray-500 hover:text-rp-navy'
              }`}
            >
              Single Property
            </button>
            <button
              onClick={() => setIsPortfolio(true)}
              className={`px-4 py-2 text-[12px] font-semibold rounded-md transition-all ${
                isPortfolio ? 'bg-rp-navy text-white' : 'text-rp-gray-500 hover:text-rp-navy'
              }`}
            >
              Portfolio (Multiple Addresses)
            </button>
          </div>
        </div>

        {isPortfolio && (
          <div>
            <p className="text-[12px] text-rp-gray-400 mb-4">
              Add each property in the portfolio. Each address will get its own OM, photos, and DD folders.
            </p>

            {portfolioAddresses.map((addr, i) => (
              <div key={i} className="border border-rp-gray-200 rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold text-rp-navy">Property {i + 1}</span>
                  <button
                    onClick={() => setPortfolioAddresses((prev) => prev.filter((_, j) => j !== i))}
                    className="text-[11px] text-rp-red hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Label / Name"
                    value={addr.label}
                    onChange={(e) => {
                      const updated = [...portfolioAddresses];
                      updated[i] = { ...updated[i], label: e.target.value };
                      setPortfolioAddresses(updated);
                    }}
                    placeholder="e.g. Building A"
                  />
                  <Input
                    label="Address"
                    value={addr.address}
                    onChange={(e) => {
                      const updated = [...portfolioAddresses];
                      updated[i] = { ...updated[i], address: e.target.value };
                      setPortfolioAddresses(updated);
                    }}
                    placeholder="123 Main St"
                  />
                  <Input
                    label="City"
                    value={addr.city}
                    onChange={(e) => {
                      const updated = [...portfolioAddresses];
                      updated[i] = { ...updated[i], city: e.target.value };
                      setPortfolioAddresses(updated);
                    }}
                    placeholder="New York"
                  />
                  <Input
                    label="State"
                    value={addr.state}
                    onChange={(e) => {
                      const updated = [...portfolioAddresses];
                      updated[i] = { ...updated[i], state: e.target.value };
                      setPortfolioAddresses(updated);
                    }}
                    placeholder="NY"
                  />
                  <Input
                    label="Square Footage"
                    value={addr.sf}
                    onChange={(e) => {
                      const updated = [...portfolioAddresses];
                      updated[i] = { ...updated[i], sf: e.target.value };
                      setPortfolioAddresses(updated);
                    }}
                    placeholder="50,000"
                  />
                  <Input
                    label="Units"
                    value={addr.units}
                    onChange={(e) => {
                      const updated = [...portfolioAddresses];
                      updated[i] = { ...updated[i], units: e.target.value };
                      setPortfolioAddresses(updated);
                    }}
                    placeholder="24"
                  />
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPortfolioAddresses((prev) => [...prev, { label: '', address: '', city: '', state: '', sf: '', units: '' }])}
            >
              + Add Property
            </Button>
          </div>
        )}
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

      {/* Financial Inputs */}
      {(() => {
        const ci = parseDealInputs({
          purchase_price: form.purchase_price, noi: form.noi, ltv: form.ltv,
          interest_rate: form.interest_rate, amortization_years: form.amortization_years,
          loan_fee_points: form.loan_fee_points, io_period_months: form.io_period_months,
          seller_financing: form.seller_financing, mezz_percent: form.mezz_percent,
          mezz_rate: form.mezz_rate, mezz_term_months: form.mezz_term_months,
          seller_credit: form.seller_credit, assignment_fee: form.assignment_fee,
          acq_fee: form.acq_fee, asset_mgmt_fee: form.asset_mgmt_fee,
          gp_carry: form.gp_carry, pref_return: form.pref_return,
          hold_period_years: form.hold_period_years, exit_cap_rate: form.exit_cap_rate,
        });
        const m = calculateDeal(ci);
        const fmt = (n: number) => '$' + Math.round(n).toLocaleString();
        const pct = (n: number, d = 1) => n.toFixed(d) + '%';
        return (<>
          <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
            <h2 className="text-[16px] font-semibold text-rp-navy mb-5">Financial Inputs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Input label="Purchase Price *" value={form.purchase_price} onChange={(e) => updateField('purchase_price', e.target.value)} error={errors.purchase_price} placeholder="e.g. 5000000" />
              <Input label="NOI" value={form.noi} onChange={(e) => updateField('noi', e.target.value)} placeholder="e.g. 450000" />
            </div>

            <h3 className="text-[13px] font-semibold text-rp-gray-500 mb-3">Senior Debt Assumptions</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <Input label="LTV %" value={form.ltv} onChange={(e) => updateField('ltv', e.target.value)} placeholder="75" />
              <Input label="Rate %" value={form.interest_rate} onChange={(e) => updateField('interest_rate', e.target.value)} placeholder="6.00" />
              <Input label="Amort (yrs)" value={form.amortization_years} onChange={(e) => updateField('amortization_years', e.target.value)} placeholder="30" />
              <Input label="Loan Fee (pts)" value={form.loan_fee_points} onChange={(e) => updateField('loan_fee_points', e.target.value)} placeholder="1" />
              <Input label="IO Period (mo)" value={form.io_period_months} onChange={(e) => updateField('io_period_months', e.target.value)} placeholder="0" />
            </div>

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-rp-gray-500">Seller Mezzanine</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.seller_financing} onChange={(e) => updateField('seller_financing', e.target.checked)} className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold" />
                <span className="text-[12px] text-rp-gray-500">Seller financing available</span>
              </label>
            </div>
            {form.seller_financing && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                <Input label="Mezz %" value={form.mezz_percent} onChange={(e) => updateField('mezz_percent', e.target.value)} placeholder="15" />
                <Input label="Mezz Rate %" value={form.mezz_rate} onChange={(e) => updateField('mezz_rate', e.target.value)} placeholder="5.00" />
                <Input label="Mezz Term (mo)" value={form.mezz_term_months} onChange={(e) => updateField('mezz_term_months', e.target.value)} placeholder="60" />
              </div>
            )}
            {form.seller_financing && <p className="text-[11px] text-rp-gray-400 mb-4">Mezzanine is interest-only with balloon payment at maturity.</p>}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <Input label="Seller Credit $" value={form.seller_credit} onChange={(e) => updateField('seller_credit', e.target.value)} placeholder="0" />
              <Input label="Hold (yrs)" value={form.hold_period_years} onChange={(e) => updateField('hold_period_years', e.target.value)} placeholder="5" />
              <Input label="Exit Cap %" value={form.exit_cap_rate} onChange={(e) => updateField('exit_cap_rate', e.target.value)} placeholder="Same as entry" />
              <Input label="Pref Return %" value={form.pref_return} onChange={(e) => updateField('pref_return', e.target.value)} placeholder="8" />
            </div>
          </div>

          {/* Live Computed Metrics */}
          <div className="bg-gradient-to-br from-[#07090F] via-[#0A1628] to-[#0E3470] rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[16px]">⚡</span>
              <h2 className="text-[15px] font-semibold">Computed Metrics</h2>
              <span className="text-[10px] text-white/30 ml-1">Updates live</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { l: 'Cap Rate', v: pct(m.capRate), c: '#BC9C45' },
                { l: 'CoC Return', v: pct(m.cocReturn), c: m.cocReturn >= 0 ? '#0B8A4D' : '#DC2626' },
                { l: 'IRR', v: m.irr !== null ? pct(m.irr) : 'N/A', c: '#0B8A4D' },
                { l: 'Eq. Multiple', v: m.equityMultiple.toFixed(2) + 'x', c: '#BC9C45' },
              ].map((x) => (
                <div key={x.l} className="bg-white/[0.05] rounded-lg p-3 border border-white/[0.05]">
                  <div className="text-[8px] font-bold text-white/25 uppercase tracking-[1.5px]">{x.l}</div>
                  <div className="text-[20px] font-bold tabular-nums mt-0.5" style={{ color: x.c }}>{x.v}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: 'Loan Amount', v: fmt(m.loanAmount) },
                { l: 'Net Equity', v: fmt(m.netEquity) },
                { l: 'Lender DSCR', v: m.lenderDSCR.toFixed(2) + 'x' },
                { l: 'Distributable CF', v: fmt(m.distributableCashFlow) },
                { l: 'Total Leverage', v: pct(m.totalLeverage) },
                ...(form.seller_financing ? [{ l: 'Combined DSCR', v: m.combinedDSCR.toFixed(2) + 'x' }] : [{ l: 'Annual DS', v: fmt(m.annualSeniorDS) }]),
              ].map((x) => (
                <div key={x.l} className="flex justify-between items-center py-1.5 px-2.5 bg-white/[0.03] rounded">
                  <span className="text-[10px] text-white/30">{x.l}</span>
                  <span className="text-[12px] font-semibold text-white tabular-nums">{x.v}</span>
                </div>
              ))}
            </div>
          </div>
        </>);
      })()}

      {/* Fee Structure */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">Fee Structure</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Input label="Assignment Fee %" value={form.assignment_fee} onChange={(e) => updateField('assignment_fee', e.target.value)} placeholder="3" />
          <Input label="Acquisition Fee %" value={form.acq_fee} onChange={(e) => updateField('acq_fee', e.target.value)} placeholder="1" />
          <Input label="Asset Mgmt Fee %" value={form.asset_mgmt_fee} onChange={(e) => updateField('asset_mgmt_fee', e.target.value)} placeholder="2" />
          <Input label="GP Carry %" value={form.gp_carry} onChange={(e) => updateField('gp_carry', e.target.value)} placeholder="20" />
        </div>
      </div>

      {/* Special Terms */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-3">Special Terms</h2>
        <textarea
          value={form.special_terms}
          onChange={(e) => updateField('special_terms', e.target.value)}
          placeholder="Additional terms not captured in structured fields above (personal guarantees, special conditions, assignment restrictions, etc.)"
          rows={3}
          className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold placeholder:text-rp-gray-400 transition-all resize-vertical"
        />
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
        <p className="text-[11px] text-rp-gray-400 mt-2 mb-4">
          PSA countdown shows 7 days from draft start to DD. LOI date is displayed on the investor card.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Deposit Amount"
            value={form.deposit_amount}
            onChange={(e) => updateField('deposit_amount', e.target.value)}
            placeholder="e.g. $50,000"
          />
          <Input
            label="Deposit Held By"
            value={form.deposit_held_by}
            onChange={(e) => updateField('deposit_held_by', e.target.value)}
            placeholder="e.g. Chicago Title Company"
          />
        </div>
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
