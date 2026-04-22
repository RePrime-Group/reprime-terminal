'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import DealSubNav from '@/components/admin/DealSubNav';
import { parseDealInputs, calculateDeal } from '@/lib/utils/deal-calculator';
import { createClient } from '@/lib/supabase/client';
import {
  DEAL_STATUS_LABELS,
  DEAL_STATUS_TRANSITIONS,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from '@/lib/constants';
import type {
  TerminalDeal,
  TerminalDealPhoto,
  TerminalDealAddress,
  TerminalUser,
  DealStatus,
  UserRole,
} from '@/lib/types/database';

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
  note_sale: boolean;
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
  rent_growth: string;
  legal_title_estimate: string;
  disposition_cost_pct: string;
  capex: string;
  debt_terms_quoted: boolean;
  // Asset mgmt fee already exists as asset_mgmt_fee
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

function toDatetimeLocal(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dealToForm(deal: TerminalDeal): DealFormData {
  return {
    name: deal.name,
    property_type: deal.property_type,
    city: deal.city,
    state: deal.state,
    square_footage: deal.square_footage ?? '',
    units: deal.units ?? '',
    class_type: deal.class_type ?? '',
    year_built: deal.year_built?.toString() ?? '',
    occupancy: deal.occupancy ?? '',
    purchase_price: deal.purchase_price,
    noi: deal.noi ?? '',
    cap_rate: deal.cap_rate ?? '',
    irr: deal.irr ?? '',
    coc: deal.coc ?? '',
    dscr: deal.dscr ?? '',
    equity_required: deal.equity_required ?? '',
    loan_estimate: deal.loan_estimate ?? '',
    seller_financing: deal.seller_financing,
    note_sale: deal.note_sale ?? false,
    special_terms: deal.special_terms,
    assignment_fee: deal.assignment_fee,
    assignment_irr: deal.assignment_irr ?? '',
    gplp_irr: deal.gplp_irr ?? '',
    acq_fee: deal.acq_fee,
    asset_mgmt_fee: deal.asset_mgmt_fee,
    gp_carry: deal.gp_carry,
    loan_fee: deal.loan_fee,
    ltv: deal.ltv ?? '75',
    interest_rate: deal.interest_rate ?? '6.00',
    amortization_years: deal.amortization_years ?? '30',
    loan_fee_points: deal.loan_fee_points ?? '0',
    io_period_months: deal.io_period_months ?? '0',
    mezz_percent: deal.mezz_percent ?? '15',
    mezz_rate: deal.mezz_rate ?? '5.00',
    mezz_term_months: deal.mezz_term_months ?? '60',
    seller_credit: deal.seller_credit ?? '0',
    pref_return: deal.pref_return ?? '0',
    hold_period_years: deal.hold_period_years ?? '5',
    exit_cap_rate: deal.exit_cap_rate ?? '',
    rent_growth: deal.rent_growth ?? '',
    legal_title_estimate: deal.legal_title_estimate ?? '',
    disposition_cost_pct: deal.disposition_cost_pct ?? '',
    capex: deal.capex ?? '',
    debt_terms_quoted: deal.debt_terms_quoted ?? false,
    dd_deadline: toDatetimeLocal(deal.dd_deadline),
    close_deadline: toDatetimeLocal(deal.close_deadline),
    extension_deadline: toDatetimeLocal(deal.extension_deadline),
    psa_draft_start: toDatetimeLocal(deal.psa_draft_start),
    loi_signed_at: toDatetimeLocal(deal.loi_signed_at),
    teaser_description: deal.teaser_description ?? '',
    deposit_amount: deal.deposit_amount ?? '',
    deposit_held_by: deal.deposit_held_by ?? '',
    neighborhood: deal.neighborhood ?? '',
    metro_population: deal.metro_population ?? '',
    job_growth: deal.job_growth ?? '',
    quarter_release: deal.quarter_release ?? '',
    investment_highlights:
      deal.investment_highlights && deal.investment_highlights.length > 0
        ? deal.investment_highlights
        : [''],
    acquisition_thesis: deal.acquisition_thesis ?? '',
  };
}

export default function EditDealPage() {
  const params = useParams<{ locale: string; id: string }>();
  const locale = params.locale;
  const dealId = params.id;
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deal, setDeal] = useState<TerminalDeal | null>(null);
  const [form, setForm] = useState<DealFormData | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Pick<
    TerminalUser,
    'role'
  > | null>(null);

  // Status management
  const [newStatus, setNewStatus] = useState<DealStatus | ''>('');
  const [investors, setInvestors] = useState<
    Pick<TerminalUser, 'id' | 'full_name' | 'email'>[]
  >([]);
  const [selectedInvestor, setSelectedInvestor] = useState('');

  // Photos
  const [photos, setPhotos] = useState<TerminalDealPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [omPath, setOmPath] = useState<string | null>(null);
  const [omUploading, setOmUploading] = useState(false);
  const omInputRef = useRef<HTMLInputElement>(null);

  // Additional deal-level documents (signed LOI, PSA, full report, CoStar)
  type DocKey = 'om' | 'loi' | 'psa' | 'full-report' | 'costar-report';
  const DOC_CONFIG: Record<DocKey, {
    label: string;
    column: 'om_storage_path' | 'loi_signed_storage_path' | 'psa_storage_path' | 'full_report_storage_path' | 'costar_report_storage_path';
    pathSegment: string;
    tabLabel: string;
  }> = {
    'om': { label: 'Offering Memorandum (OM)', column: 'om_storage_path', pathSegment: 'om', tabLabel: 'OM' },
    'loi': { label: 'Signed LOI', column: 'loi_signed_storage_path', pathSegment: 'loi', tabLabel: 'Signed LOI' },
    'psa': { label: 'Purchase and Sale Agreement (PSA)', column: 'psa_storage_path', pathSegment: 'psa', tabLabel: 'PSA' },
    'full-report': { label: 'Full Report', column: 'full_report_storage_path', pathSegment: 'full-report', tabLabel: 'Full Report' },
    'costar-report': { label: 'CoStar Report', column: 'costar_report_storage_path', pathSegment: 'costar', tabLabel: 'CoStar Report' },
  };
  const [docPaths, setDocPaths] = useState<Record<Exclude<DocKey, 'om'>, string | null>>({
    'loi': null, 'psa': null, 'full-report': null, 'costar-report': null,
  });
  const [activeDocTab, setActiveDocTab] = useState<DocKey>('om');
  const [docUploading, setDocUploading] = useState<DocKey | null>(null);
  const docInputRefs = useRef<Record<Exclude<DocKey, 'om'>, HTMLInputElement | null>>({
    'loi': null, 'psa': null, 'full-report': null, 'costar-report': null,
  });

  // Portfolio addresses
  const [addresses, setAddresses] = useState<TerminalDealAddress[]>([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressAddr, setNewAddressAddr] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const addressOmRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Pipeline stage
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDeal = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: termUser } = await supabase
        .from('terminal_users')
        .select('role')
        .eq('id', user.id)
        .single();
      if (termUser) setCurrentUser(termUser as Pick<TerminalUser, 'role'>);

      const { data: dealData } = await supabase
        .from('terminal_deals')
        .select('*')
        .eq('id', dealId)
        .single();

      if (!dealData) {
        router.push(`/${locale}/admin/deals`);
        return;
      }

      const typedDeal = dealData as TerminalDeal;
      setDeal(typedDeal);
      setForm(dealToForm(typedDeal));
      setNewStatus(typedDeal.status);
      setOmPath(typedDeal.om_storage_path ?? null);
      setDocPaths({
        'loi': typedDeal.loi_signed_storage_path ?? null,
        'psa': typedDeal.psa_storage_path ?? null,
        'full-report': typedDeal.full_report_storage_path ?? null,
        'costar-report': typedDeal.costar_report_storage_path ?? null,
      });

      const { data: photosData } = await supabase
        .from('terminal_deal_photos')
        .select('*')
        .eq('deal_id', dealId)
        .order('display_order', { ascending: true });
      setPhotos((photosData as TerminalDealPhoto[]) ?? []);

      // Fetch addresses
      const { data: addressData } = await supabase
        .from('terminal_deal_addresses')
        .select('*')
        .eq('deal_id', dealId)
        .order('display_order', { ascending: true });
      setAddresses((addressData as TerminalDealAddress[]) ?? []);

      // Fetch current pipeline stage
      const { data: stageData } = await supabase
        .from('terminal_deal_stages')
        .select('stage')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPipelineStage(stageData?.stage ?? null);
    } finally {
      setLoading(false);
    }
  }, [dealId, locale, router, supabase]);

  useEffect(() => {
    fetchDeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // Fetch investors when status changes to "assigned"
  useEffect(() => {
    if (newStatus !== 'assigned') return;
    const fetchInvestors = async () => {
      const { data } = await supabase
        .from('terminal_users')
        .select('id, full_name, email')
        .eq('role', 'investor')
        .eq('is_active', true)
        .order('full_name');
      setInvestors(
        (data as Pick<TerminalUser, 'id' | 'full_name' | 'email'>[]) ?? []
      );
    };
    fetchInvestors();
  }, [newStatus, supabase]);

  const updateField = <K extends keyof DealFormData>(
    key: K,
    value: DealFormData[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (key in errors) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const addHighlight = () => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            investment_highlights: [...prev.investment_highlights, ''],
          }
        : prev
    );
  };

  const updateHighlight = (index: number, value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const updated = [...prev.investment_highlights];
      updated[index] = value;
      return { ...prev, investment_highlights: updated };
    });
  };

  const removeHighlight = (index: number) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            investment_highlights: prev.investment_highlights.filter(
              (_, i) => i !== index
            ),
          }
        : prev
    );
  };

  const validate = (): boolean => {
    if (!form) return false;
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.state.trim()) newErrors.state = 'State is required';
    if (!form.property_type)
      newErrors.property_type = 'Property type is required';
    if (!form.purchase_price.trim())
      newErrors.purchase_price = 'Purchase price is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getAllowedTransitions = (): DealStatus[] => {
    if (!deal || !currentUser) return [];
    const transition = DEAL_STATUS_TRANSITIONS[deal.status];
    if (!transition) return [];
    if (!transition.roles.includes(currentUser.role)) return [];
    return transition.to as DealStatus[];
  };

  const handleSave = async () => {
    if (!form || !deal) return;
    if (!validate()) return;
    setSaving(true);

    try {
      const highlights = form.investment_highlights.filter(
        (h) => h.trim() !== ''
      );

      const statusToSave =
        newStatus && newStatus !== deal.status ? newStatus : deal.status;

      const updateData: Record<string, unknown> = {
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
        note_sale: form.note_sale,
        special_terms: form.special_terms,
        assignment_fee: form.assignment_fee,
        assignment_irr: form.assignment_irr || null,
        gplp_irr: form.gplp_irr || null,
        acq_fee: form.acq_fee,
        asset_mgmt_fee: form.asset_mgmt_fee,
        gp_carry: form.gp_carry,
        loan_fee: form.loan_fee,
        ltv: form.ltv || '75',
        interest_rate: form.interest_rate || '6.00',
        amortization_years: form.amortization_years || '30',
        loan_fee_points: form.loan_fee_points || '0',
        io_period_months: form.io_period_months || '0',
        mezz_percent: form.mezz_percent || '15',
        mezz_rate: form.mezz_rate || '5.00',
        mezz_term_months: form.mezz_term_months || '60',
        seller_credit: form.seller_credit || '0',
        pref_return: form.pref_return || '0',
        hold_period_years: form.hold_period_years || '5',
        exit_cap_rate: form.exit_cap_rate || null,
        rent_growth: form.rent_growth || null,
        legal_title_estimate: form.legal_title_estimate || null,
        disposition_cost_pct: form.disposition_cost_pct || null,
        capex: form.capex || null,
        debt_terms_quoted: form.debt_terms_quoted,
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
        status: statusToSave,
      };

      if (statusToSave === 'assigned' && selectedInvestor) {
        updateData.assigned_to = selectedInvestor;
      }

      // Persist computed metrics from calculation engine
      const computedInputs = parseDealInputs(updateData as Record<string, unknown>);
      const computedMetrics = calculateDeal(computedInputs);
      updateData.cap_rate = computedMetrics.capRate > 0 ? computedMetrics.capRate.toFixed(2) : null;
      updateData.irr = computedMetrics.irr !== null ? computedMetrics.irr.toFixed(2) : null;
      updateData.coc = computedMetrics.cocReturn !== null ? computedMetrics.cocReturn.toFixed(2) : null;
      updateData.dscr = computedMetrics.combinedDSCR > 0 ? computedMetrics.combinedDSCR.toFixed(2) : null;
      updateData.equity_required = computedMetrics.netEquity > 0 ? String(Math.round(computedMetrics.netEquity)) : null;
      updateData.loan_estimate = computedMetrics.loanAmount > 0 ? String(Math.round(computedMetrics.loanAmount)) : null;

      const { error } = await supabase
        .from('terminal_deals')
        .update(updateData)
        .eq('id', dealId);

      if (error) {
        console.error('Failed to update deal:', error);
        alert('Failed to update deal. Please try again.');
        return;
      }

      // Fire notification dispatch (best-effort; never blocks the save).
      try {
        const becamePublished =
          statusToSave === 'published' && deal.status !== 'published';
        if (becamePublished) {
          await fetch(`/api/admin/deals/${dealId}/notify-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'new_deal' }),
          });
        } else {
          const WATCH: (keyof typeof updateData)[] = [
            'purchase_price',
            'om_storage_path',
            'dd_deadline',
            'close_deadline',
            'extension_deadline',
            'psa_draft_start',
            'loi_signed_at',
            'quarter_release',
          ];
          const DATE_FIELDS = new Set<string>([
            'dd_deadline',
            'close_deadline',
            'extension_deadline',
            'psa_draft_start',
            'loi_signed_at',
          ]);
          const normalize = (field: string, v: unknown): string => {
            if (v === undefined || v === null || v === '') return '';
            if (DATE_FIELDS.has(field)) {
              const t = new Date(String(v)).getTime();
              return isNaN(t) ? '' : String(t);
            }
            return String(v).trim();
          };
          const changedFields = WATCH.filter((f) => {
            const next = updateData[f];
            // Field not being updated by this save (e.g. om_storage_path is managed separately).
            if (next === undefined) return false;
            const before = (deal as unknown as Record<string, unknown>)[f];
            return normalize(f, before) !== normalize(f, next);
          });
          if (changedFields.length > 0) {
            await fetch(`/api/admin/deals/${dealId}/notify-event`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'deal_activity', changedFields }),
            });
          }
        }
      } catch (err) {
        console.error('Failed to dispatch deal notifications:', err);
      }

      router.push(`/${locale}/admin/deals`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/delete`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        console.error('Failed to delete deal:', data.error);
        alert(data.error || 'Failed to delete deal.');
        return;
      }

      router.push(`/${locale}/admin/deals`);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setPhotoUploadError(null);
    const errors: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          errors.push(`${file.name}: unsupported image type`);
          continue;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          errors.push(`${file.name}: exceeds 10MB limit`);
          continue;
        }

        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `${dealId}/${Date.now()}-${i}.${ext}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from('terminal-deal-photos')
            .upload(path, file);

          if (uploadError) {
            errors.push(`${file.name}: ${uploadError.message}`);
            continue;
          }
        } catch (networkErr) {
          errors.push(`${file.name}: network error — check your connection`);
          continue;
        }

        const nextOrder = photos.length + i;
        const { data: photoRecord, error: insertError } = await supabase
          .from('terminal_deal_photos')
          .insert({
            deal_id: dealId,
            storage_path: path,
            display_order: nextOrder,
          })
          .select()
          .single();

        if (insertError) {
          errors.push(`${file.name}: saved to storage but failed to create record — ${insertError.message}`);
          continue;
        }

        if (photoRecord) {
          setPhotos((prev) => [...prev, photoRecord as TerminalDealPhoto]);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (errors.length > 0) {
        setPhotoUploadError(errors.join('. '));
      }
    }
  };

  const handlePhotoDelete = async (photo: TerminalDealPhoto) => {
    await supabase.storage
      .from('terminal-deal-photos')
      .remove([photo.storage_path]);

    await supabase.from('terminal_deal_photos').delete().eq('id', photo.id);

    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  };

  const getPhotoUrl = (photo: TerminalDealPhoto): string => {
    const { data } = supabase.storage
      .from('terminal-deal-photos')
      .getPublicUrl(photo.storage_path);
    return data.publicUrl;
  };

  const handleOmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('OM must be a PDF file.');
      return;
    }

    setOmUploading(true);
    try {
      const path = `${dealId}/om/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('terminal-dd-documents')
        .upload(path, file, { upsert: true });

      if (uploadError) {
        alert(`Upload failed: ${uploadError.message}`);
        return;
      }

      // Update deal record with OM path
      await supabase
        .from('terminal_deals')
        .update({ om_storage_path: path })
        .eq('id', dealId);

      setOmPath(path);
    } finally {
      setOmUploading(false);
      if (omInputRef.current) omInputRef.current.value = '';
    }
  };

  const handleOmRemove = async () => {
    if (!omPath) return;
    await supabase.storage.from('terminal-dd-documents').remove([omPath]);
    await supabase.from('terminal_deals').update({ om_storage_path: null }).eq('id', dealId);
    setOmPath(null);
  };

  const handleDocUpload = async (
    docKey: Exclude<DocKey, 'om'>,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert(`${DOC_CONFIG[docKey].label} must be a PDF file.`);
      return;
    }

    setDocUploading(docKey);
    try {
      const path = `${dealId}/${DOC_CONFIG[docKey].pathSegment}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('terminal-dd-documents')
        .upload(path, file, { upsert: true });
      if (uploadError) {
        alert(`Upload failed: ${uploadError.message}`);
        return;
      }
      await supabase
        .from('terminal_deals')
        .update({ [DOC_CONFIG[docKey].column]: path })
        .eq('id', dealId);
      setDocPaths((prev) => ({ ...prev, [docKey]: path }));
    } finally {
      setDocUploading(null);
      const input = docInputRefs.current[docKey];
      if (input) input.value = '';
    }
  };

  const handleDocRemove = async (docKey: Exclude<DocKey, 'om'>) => {
    const current = docPaths[docKey];
    if (!current) return;
    await supabase.storage.from('terminal-dd-documents').remove([current]);
    await supabase
      .from('terminal_deals')
      .update({ [DOC_CONFIG[docKey].column]: null })
      .eq('id', dealId);
    setDocPaths((prev) => ({ ...prev, [docKey]: null }));
  };

  // Address management
  const handleAddAddress = async () => {
    if (!newAddressLabel.trim()) return;
    const { data, error } = await supabase
      .from('terminal_deal_addresses')
      .insert({
        deal_id: dealId,
        label: newAddressLabel.trim(),
        address: newAddressAddr.trim() || null,
        city: newAddressCity.trim() || null,
        state: newAddressState.trim() || null,
        display_order: addresses.length,
      })
      .select()
      .single();

    if (!error && data) {
      setAddresses((prev) => [...prev, data as TerminalDealAddress]);
      setNewAddressLabel('');
      setNewAddressAddr('');
      setNewAddressCity('');
      setNewAddressState('');
      setShowAddAddress(false);
    }
  };

  const handleRemoveAddress = async (addressId: string) => {
    await supabase.from('terminal_deal_addresses').delete().eq('id', addressId);
    setAddresses((prev) => prev.filter((a) => a.id !== addressId));
  };

  const handleAddressOmUpload = async (addressId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    const path = `${dealId}/om/${addressId}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from('terminal-dd-documents')
      .upload(path, file, { upsert: true });

    if (!error) {
      await supabase
        .from('terminal_deal_addresses')
        .update({ om_storage_path: path })
        .eq('id', addressId);

      setAddresses((prev) =>
        prev.map((a) => a.id === addressId ? { ...a, om_storage_path: path } : a)
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-rp-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!deal || !form) {
    return (
      <div className="text-center py-16">
        <p className="text-rp-gray-500">Deal not found.</p>
        <Link
          href={`/${locale}/admin/deals`}
          className="text-rp-gold hover:underline text-sm mt-2 inline-block"
        >
          Back to deals
        </Link>
      </div>
    );
  }

  const allowedTransitions = getAllowedTransitions();

  return (
    <div className="max-w-4xl font-[family-name:var(--font-poppins)]">
      {/* Header */}
      <div className="mb-8">
        <DealSubNav dealId={dealId} dealName={deal?.name ?? 'Deal'} locale={locale} />

        {/* Pipeline Stage Indicator */}
        {(() => {
          const stages = ['post_loi', 'due_diligence', 'pre_closing', 'post_closing'];
          const stageLabels: Record<string, string> = {
            post_loi: 'POST LOI',
            due_diligence: 'DUE DILIGENCE',
            pre_closing: 'PRE-CLOSING',
            post_closing: 'POST-CLOSING',
          };
          const currentIdx = pipelineStage ? stages.indexOf(pipelineStage) : -1;

          return (
            <div className="mt-4 flex items-center gap-0">
              {stages.map((stage, idx) => {
                const isCompleted = currentIdx > idx;
                const isCurrent = currentIdx === idx;
                const isPending = currentIdx < idx;

                return (
                  <div key={stage} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <span
                        className={`text-[10px] font-semibold tracking-wide mb-1.5 ${
                          isCurrent
                            ? 'text-rp-gold'
                            : isCompleted
                            ? 'text-green-600'
                            : 'text-rp-gray-400'
                        }`}
                      >
                        {stageLabels[stage]}
                      </span>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isCurrent
                            ? 'bg-rp-gold text-white ring-2 ring-rp-gold/30'
                            : 'border-2 border-rp-gray-300 text-rp-gray-300'
                        }`}
                      >
                        {isCompleted ? (
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
                          </svg>
                        ) : isPending ? (
                          ''
                        ) : (
                          ''
                        )}
                      </div>
                    </div>
                    {idx < stages.length - 1 && (
                      <div
                        className={`w-12 h-0.5 mt-4 mx-1 ${
                          currentIdx > idx ? 'bg-green-400' : 'bg-rp-gray-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
              {currentIdx === -1 && (
                <span className="ml-4 text-xs text-rp-gray-400 mt-4">No stage set</span>
              )}
            </div>
          );
        })()}
      </div>

      {/* Status Section */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-4">Status</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-rp-gray-500">Current:</span>
            <Badge variant={deal.status}>
              {DEAL_STATUS_LABELS[deal.status] ?? deal.status}
            </Badge>
          </div>

          {allowedTransitions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-rp-gray-500">Change to:</span>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as DealStatus)}
                className="px-3.5 py-2 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors bg-white"
              >
                <option value={deal.status}>
                  {DEAL_STATUS_LABELS[deal.status]} (current)
                </option>
                {allowedTransitions.map((s) => (
                  <option key={s} value={s}>
                    {DEAL_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {newStatus === 'assigned' && newStatus !== deal.status && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-rp-gray-500">Assign to:</span>
              <select
                value={selectedInvestor}
                onChange={(e) => setSelectedInvestor(e.target.value)}
                className="px-3.5 py-2 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold transition-colors bg-white"
              >
                <option value="">Select investor...</option>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.full_name} ({inv.email})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
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

      {/* Section 2: Financial Inputs + Computed Metrics */}
      {(() => {
        const inputs = parseDealInputs({
          purchase_price: form.purchase_price, noi: form.noi, ltv: form.ltv,
          interest_rate: form.interest_rate, amortization_years: form.amortization_years,
          loan_fee_points: form.loan_fee_points, io_period_months: form.io_period_months,
          seller_financing: form.seller_financing, mezz_percent: form.mezz_percent,
          mezz_rate: form.mezz_rate, mezz_term_months: form.mezz_term_months,
          seller_credit: form.seller_credit, assignment_fee: form.assignment_fee,
          acq_fee: form.acq_fee, asset_mgmt_fee: form.asset_mgmt_fee,
          gp_carry: form.gp_carry, pref_return: form.pref_return,
          hold_period_years: form.hold_period_years, exit_cap_rate: form.exit_cap_rate,
          rent_growth: form.rent_growth,
          legal_title_estimate: form.legal_title_estimate,
          disposition_cost_pct: form.disposition_cost_pct,
          capex: form.capex,
        });
        const m = calculateDeal(inputs);
        const fmt = (n: number) => '$' + Math.round(n).toLocaleString();
        const pct = (n: number, d = 2) => n.toFixed(d) + '%';

        return (<>
          {/* Core Inputs */}
          <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
            <h2 className="text-[16px] font-semibold text-rp-navy mb-5">Property Financials</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Purchase Price *" value={form.purchase_price} onChange={(e) => updateField('purchase_price', e.target.value)} error={errors.purchase_price} placeholder="e.g. 12500000" />
              <Input label="NOI *" value={form.noi} onChange={(e) => updateField('noi', e.target.value)} placeholder="e.g. 850000" />
            </div>
          </div>

          {/* Senior Debt */}
          <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold text-rp-navy">Senior Debt Parameters</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.debt_terms_quoted} onChange={(e) => updateField('debt_terms_quoted', e.target.checked)} className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold" />
                <span className="text-[12px] font-medium text-rp-gray-500">Actual lender quote received</span>
              </label>
            </div>
            {!form.debt_terms_quoted && (
              <div className="mb-4 p-3 bg-rp-amber-light border border-rp-amber-border rounded-lg text-[12px] text-rp-amber font-medium">
                ⚠ Using estimated defaults — update when lender quote is received
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Input label="LTV %" value={form.ltv} onChange={(e) => updateField('ltv', e.target.value)} placeholder="75" />
              <Input label="Interest Rate %" value={form.interest_rate} onChange={(e) => updateField('interest_rate', e.target.value)} placeholder="6.00" />
              <Input label="Amortization (yrs)" value={form.amortization_years} onChange={(e) => updateField('amortization_years', e.target.value)} placeholder="30" />
              <Input label="Loan Fee (pts)" value={form.loan_fee_points} onChange={(e) => updateField('loan_fee_points', e.target.value)} placeholder="0 (blank = 0 pts)" />
              <Input label="IO Period (mo)" value={form.io_period_months} onChange={(e) => updateField('io_period_months', e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Mezzanine */}
          <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-semibold text-rp-navy">Seller Mezzanine</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.seller_financing} onChange={(e) => updateField('seller_financing', e.target.checked)} className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold" />
                <span className="text-[12px] font-medium text-rp-gray-500">Seller financing available</span>
              </label>
            </div>
            {form.seller_financing && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Mezz % of Purchase" value={form.mezz_percent} onChange={(e) => updateField('mezz_percent', e.target.value)} placeholder="15" />
                <Input label="Mezz Rate %" value={form.mezz_rate} onChange={(e) => updateField('mezz_rate', e.target.value)} placeholder="5.00" />
                <Input label="Mezz Term (months)" value={form.mezz_term_months} onChange={(e) => updateField('mezz_term_months', e.target.value)} placeholder="60" />
              </div>
            )}
            {!form.seller_financing && <p className="text-[13px] text-rp-gray-400">No seller financing for this deal.</p>}
          </div>

          {/* Credits & Exit */}
          <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
            <h2 className="text-[16px] font-semibold text-rp-navy mb-5">Credits & Exit Assumptions</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Input label="Seller Credit ($)" value={form.seller_credit} onChange={(e) => updateField('seller_credit', e.target.value)} placeholder="0" />
              <Input label="CapEx / Capital Reserves ($)" value={form.capex} onChange={(e) => updateField('capex', e.target.value)} placeholder="e.g. 25000 (blank = $0)" />
              <Input label="Hold Period (yrs)" value={form.hold_period_years} onChange={(e) => updateField('hold_period_years', e.target.value)} placeholder="5" />
              <Input label="Exit Cap Rate %" value={form.exit_cap_rate} onChange={(e) => updateField('exit_cap_rate', e.target.value)} placeholder="e.g. 9.5 (blank = entry cap + 1%)" />
              <Input label="Pref Return %" value={form.pref_return} onChange={(e) => updateField('pref_return', e.target.value)} placeholder="0 (blank = 0%)" />
              <Input label="Annual Rent Growth %" value={form.rent_growth} onChange={(e) => updateField('rent_growth', e.target.value)} placeholder="e.g. 3.0 (blank = 0%)" />
              <Input label="Legal/Title Estimate ($)" value={form.legal_title_estimate} onChange={(e) => updateField('legal_title_estimate', e.target.value)} placeholder="e.g. 25000 (blank = $0)" />
              <Input label="Disposition Cost %" value={form.disposition_cost_pct} onChange={(e) => updateField('disposition_cost_pct', e.target.value)} placeholder="e.g. 2.0 (blank = 0%)" />
            </div>
          </div>

          {/* LIVE COMPUTED METRICS */}
          <div className="bg-gradient-to-br from-[#07090F] via-[#0A1628] to-[#0E3470] rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-[18px]">⚡</span>
              <h2 className="text-[16px] font-semibold">Live Computed Metrics</h2>
              <span className="text-[11px] text-white/40 ml-2">Auto-calculated from inputs above</span>
            </div>

            {m.warnings.length > 0 && (
              <div className="mb-4 space-y-1">
                {m.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-[#DC2626]/15 rounded-lg text-[11px] text-[#FF6B6B] font-medium">⚠ {w}</div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-4 gap-3 mb-4">
              {(() => {
                const fullyFinanced = m.netEquity <= 0;
                const hasPositiveCF = m.distributableCashFlow > 0;
                const infMetric = fullyFinanced ? (hasPositiveCF ? '∞' : 'N/A') : null;
                return [
                  { label: 'Cap Rate', value: pct(m.capRate), color: '#BC9C45' },
                  { label: 'Cash-on-Cash', value: infMetric ?? (m.cocReturn !== null ? pct(m.cocReturn) : '—'), color: fullyFinanced ? '#0B8A4D' : (m.cocReturn !== null && m.cocReturn >= 0 ? '#0B8A4D' : '#DC2626') },
                  { label: 'IRR', value: infMetric ?? (m.irr !== null ? pct(m.irr) : 'N/A'), color: '#0B8A4D' },
                  { label: 'Equity Multiple', value: infMetric ?? (m.equityMultiple !== null ? m.equityMultiple.toFixed(2) + 'x' : '—'), color: '#BC9C45' },
                ];
              })().map((metric) => (
                <div key={metric.label} className="bg-white/[0.06] rounded-xl p-3.5 border border-white/[0.06]">
                  <div className="text-[9px] font-bold text-white/30 uppercase tracking-[2px]">{metric.label}</div>
                  <div className="text-[22px] font-bold tabular-nums mt-1" style={{ color: metric.color }}>{metric.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Loan Amount', value: fmt(m.loanAmount) },
                { label: 'Annual Senior DS', value: fmt(m.annualSeniorDS) },
                { label: 'Lender DSCR', value: m.lenderDSCR.toFixed(2) + 'x' },
                ...(form.seller_financing ? [
                  { label: 'Mezz Amount', value: fmt(m.mezzAmount) },
                  { label: 'Annual Mezz IO', value: fmt(m.annualMezzPayment) },
                  { label: 'Combined DSCR', value: m.combinedDSCR.toFixed(2) + 'x' },
                ] : []),
                { label: 'Net Equity (Check Size)', value: m.netEquity > 0 ? fmt(m.netEquity) : '$0' },
                { label: 'Distributable CF', value: fmt(m.distributableCashFlow) },
                { label: 'Total Leverage', value: pct(m.totalLeverage) },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2 px-3 bg-white/[0.03] rounded-lg">
                  <span className="text-[11px] text-white/40">{row.label}</span>
                  <span className="text-[13px] font-semibold text-white tabular-nums">{row.value}</span>
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
          <Input label="Assignment Fee %" value={form.assignment_fee} onChange={(e) => updateField('assignment_fee', e.target.value)} placeholder="0 (blank = 0%)" />
          <Input label="Acquisition Fee %" value={form.acq_fee} onChange={(e) => updateField('acq_fee', e.target.value)} placeholder="0 (blank = 0%)" />
          <Input label="Asset Mgmt Fee %" value={form.asset_mgmt_fee} onChange={(e) => updateField('asset_mgmt_fee', e.target.value)} placeholder="0 (blank = 0%)" />
          <Input label="GP Carry %" value={form.gp_carry} onChange={(e) => updateField('gp_carry', e.target.value)} placeholder="0 (blank = 0%)" />
        </div>
      </div>

      {/* Special Terms */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold text-rp-navy">Special Terms</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.note_sale}
              onChange={(e) => updateField('note_sale', e.target.checked)}
              className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold"
            />
            <span className="text-[12px] font-medium text-rp-gray-500">Note sale</span>
          </label>
        </div>
        <textarea
          value={form.special_terms}
          onChange={(e) => updateField('special_terms', e.target.value)}
          placeholder="Additional terms not captured in structured fields above (personal guarantees, special conditions, assignment restrictions, etc.)"
          rows={3}
          className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold placeholder:text-rp-gray-400 transition-all resize-vertical"
        />
      </div>

      {/* Section 4: Timeline */}
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

      {/* Portfolio Addresses */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rp-navy/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E3470" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-rp-navy">Portfolio Addresses</h2>
              <p className="text-[12px] text-rp-gray-400">Add multiple properties for portfolio deals. Each address gets its own OM and DD folders.</p>
            </div>
          </div>
          <Button variant="gold" size="sm" onClick={() => setShowAddAddress(true)}>
            + Add Address
          </Button>
        </div>

        {addresses.length === 0 && !showAddAddress && (
          <div className="text-center py-6 text-[13px] text-rp-gray-400">
            No addresses added. Single-property deals don&apos;t need addresses.
          </div>
        )}

        {/* Address cards */}
        {addresses.map((addr) => (
          <div key={addr.id} className="border border-rp-gray-200 rounded-xl p-4 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-rp-navy/5 flex items-center justify-center text-[16px]">🏢</div>
              <div>
                <div className="text-[14px] font-semibold text-rp-navy">{addr.label}</div>
                <div className="text-[12px] text-rp-gray-500">
                  {[addr.address, addr.city, addr.state].filter(Boolean).join(', ') || 'No address details'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* OM upload for this address */}
              {addr.om_storage_path ? (
                <span className="text-[11px] font-medium text-rp-green bg-rp-green-light px-3 py-1 rounded-full">
                  ✓ OM Uploaded
                </span>
              ) : (
                <button
                  onClick={() => addressOmRefs.current[addr.id]?.click()}
                  className="text-[11px] font-medium text-rp-gold hover:underline"
                >
                  Upload OM
                </button>
              )}
              <input
                ref={(el) => { addressOmRefs.current[addr.id] = el; }}
                type="file"
                accept="application/pdf"
                onChange={(e) => handleAddressOmUpload(addr.id, e)}
                className="hidden"
              />
              <button
                onClick={() => handleRemoveAddress(addr.id)}
                className="text-[11px] text-rp-red hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {/* Add address form */}
        {showAddAddress && (
          <div className="border border-rp-gold-border bg-rp-gold-bg/50 rounded-xl p-4 mt-3">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input
                label="Label *"
                value={newAddressLabel}
                onChange={(e) => setNewAddressLabel(e.target.value)}
                placeholder="e.g. Building A or 123 Main St"
              />
              <Input
                label="Street Address"
                value={newAddressAddr}
                onChange={(e) => setNewAddressAddr(e.target.value)}
                placeholder="123 Main Street"
              />
              <Input
                label="City"
                value={newAddressCity}
                onChange={(e) => setNewAddressCity(e.target.value)}
                placeholder="New York"
              />
              <Input
                label="State"
                value={newAddressState}
                onChange={(e) => setNewAddressState(e.target.value)}
                placeholder="NY"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="gold" size="sm" onClick={handleAddAddress}>
                Add Address
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowAddAddress(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Deal Documents — tabbed upload card (OM + Signed LOI + PSA + Full Report + CoStar Report) */}
      <div className="bg-white rounded-2xl border border-rp-gold-border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-rp-gold/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div>
            <h2 className="text-[16px] font-semibold text-rp-navy">Deal Documents</h2>
            <p className="text-[12px] text-rp-gray-400">Upload the key deal-level documents. Each tab stores a separate file.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-rp-gray-200 mb-5">
          {(Object.keys(DOC_CONFIG) as DocKey[]).map((key) => {
            const hasFile = key === 'om' ? !!omPath : !!docPaths[key as Exclude<DocKey, 'om'>];
            const active = activeDocTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveDocTab(key)}
                className={`relative px-4 py-2 text-[12px] font-semibold transition-colors -mb-px border-b-2 ${
                  active
                    ? 'text-rp-gold border-rp-gold'
                    : 'text-rp-gray-500 hover:text-rp-navy border-transparent'
                }`}
              >
                {DOC_CONFIG[key].tabLabel}
                {hasFile && (
                  <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-[#0B8A4D]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active tab panel */}
        {(() => {
          const cfg = DOC_CONFIG[activeDocTab];
          const currentPath =
            activeDocTab === 'om'
              ? omPath
              : docPaths[activeDocTab as Exclude<DocKey, 'om'>];
          const uploading =
            activeDocTab === 'om' ? omUploading : docUploading === activeDocTab;
          const triggerClick = () => {
            if (activeDocTab === 'om') omInputRef.current?.click();
            else docInputRefs.current[activeDocTab as Exclude<DocKey, 'om'>]?.click();
          };
          const removeCurrent = () => {
            if (activeDocTab === 'om') return handleOmRemove();
            return handleDocRemove(activeDocTab as Exclude<DocKey, 'om'>);
          };
          return (
            <>
              <p className="text-[12px] text-rp-gray-400 mb-3">
                {activeDocTab === 'om'
                  ? 'This is the first document investors will download.'
                  : `Stored separately from the OM. Investors access ${cfg.label} via its own button in the deal detail page.`}
              </p>
              {currentPath ? (
                <div className="flex items-center justify-between bg-rp-gold-bg border border-rp-gold-border rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rp-gold/15 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-rp-navy">{cfg.label} Uploaded</p>
                      <p className="text-[11px] text-rp-gray-400 truncate max-w-[300px]">{currentPath.split('/').pop()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={triggerClick}
                      className="text-[12px] font-medium text-rp-gold hover:underline"
                    >
                      Replace
                    </button>
                    <button
                      onClick={removeCurrent}
                      className="text-[12px] font-medium text-rp-red hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-rp-gold-border rounded-xl p-8 text-center hover:border-rp-gold/60 transition-colors cursor-pointer bg-rp-gold-bg/50"
                  onClick={triggerClick}
                >
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rp-gold/10 flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p className="text-sm text-rp-navy font-medium">
                    {uploading ? `Uploading ${cfg.label}...` : `Click to upload ${cfg.label}`}
                  </p>
                  <p className="text-xs text-rp-gray-400 mt-1">PDF only</p>
                </div>
              )}
            </>
          );
        })()}

        {/* Hidden inputs — one per doc type */}
        <input
          ref={omInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleOmUpload}
          className="hidden"
        />
        {(['loi', 'psa', 'full-report', 'costar-report'] as Exclude<DocKey, 'om'>[]).map((key) => (
          <input
            key={key}
            ref={(el) => { docInputRefs.current[key] = el; }}
            type="file"
            accept="application/pdf"
            onChange={(e) => handleDocUpload(key, e)}
            className="hidden"
          />
        ))}
      </div>

      {/* Photo Management */}
      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6 mb-6">
        <h2 className="text-[16px] font-semibold text-rp-navy mb-5">Photos</h2>

        {photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-xl overflow-hidden border border-rp-gray-200 aspect-[4/3]"
              >
                <img
                  src={getPhotoUrl(photo)}
                  alt={photo.caption ?? 'Deal photo'}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handlePhotoDelete(photo)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rp-red"
                  aria-label="Delete photo"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {photoUploadError && (
          <div className="mb-4 p-3 bg-rp-red-light border border-rp-red-border rounded-lg flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-rp-red font-medium">Photo upload failed</p>
              <p className="text-xs text-rp-red/70 mt-0.5">{photoUploadError}</p>
            </div>
            <button onClick={() => setPhotoUploadError(null)} className="text-rp-red/50 hover:text-rp-red shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        <div
          className="border-2 border-dashed border-rp-gray-300 rounded-xl p-8 text-center hover:border-rp-gold/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-rp-gray-100 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-rp-gray-400"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-sm text-rp-gray-500 font-medium">
            {uploading ? 'Uploading...' : 'Click to upload photos'}
          </p>
          <p className="text-xs text-rp-gray-400 mt-1">
            JPG, PNG, or WebP up to 10MB
          </p>
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="flex items-center justify-between pb-8">
        <div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Deal
            </Button>
        </div>
        <Button variant="gold" onClick={handleSave} loading={saving}>
          Save Changes
        </Button>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Deal"
      >
        <p className="text-sm text-rp-gray-600 mb-6">
          Are you sure you want to delete &ldquo;{deal.name}&rdquo;? This action
          cannot be undone and will permanently remove all associated data including
          photos, documents, folders, pipeline tasks, commitments, meetings, and activity logs.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
