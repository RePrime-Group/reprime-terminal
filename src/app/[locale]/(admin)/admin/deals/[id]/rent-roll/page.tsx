'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import DealSubNav from '@/components/admin/DealSubNav';
import {
  computeWALT,
  computeOccupancy,
  computeTotalRent,
  sortTenantsForDisplay,
  formatYears,
  formatMoney,
  formatRentPerSf,
  parseLooseDate,
} from '@/lib/utils/rent-roll';

// <input type="date"> requires YYYY-MM-DD. Normalize any stored value
// (AI extraction may produce "MM/YYYY" or "12/2031") into that format so
// the picker renders it; unparseable legacy text falls through to empty.
function toDateInputValue(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = parseLooseDate(raw);
  if (!d || !Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
import type {
  TerminalTenantLease,
  TerminalDealAddress,
  LeaseType,
  LeaseStatus,
  TenantCreditRating,
} from '@/lib/types/database';

const LEASE_TYPES: LeaseType[] = ['NNN', 'NN', 'Modified Gross', 'Gross', 'Ground'];
const LEASE_STATUSES: LeaseStatus[] = ['Active', 'Expired', 'Month-to-Month', 'In Negotiation'];
const CREDIT_RATINGS: TenantCreditRating[] = ['Investment Grade', 'National Credit', 'Regional', 'Local', 'Unknown'];

interface TenantFormState {
  tenant_name: string;
  address_id: string;
  suite_unit: string;
  leased_sf: string;
  annual_base_rent: string;
  rent_per_sf: string;
  lease_type: LeaseType;
  lease_start_date: string;
  lease_end_date: string;
  rent_commencement_date: string;
  option_renewals: string;
  escalation_structure: string;
  cam_reimbursement: string;
  tax_reimbursement: string;
  insurance_reimbursement: string;
  percentage_rent: string;
  security_deposit: string;
  guarantor: string;
  tenant_credit_rating: string;
  tenant_industry: string;
  is_anchor: boolean;
  is_vacant: boolean;
  market_rent_estimate: string;
  notes: string;
  status: LeaseStatus;
}

const EMPTY_FORM: TenantFormState = {
  tenant_name: '',
  address_id: '',
  suite_unit: '',
  leased_sf: '',
  annual_base_rent: '',
  rent_per_sf: '',
  lease_type: 'NNN',
  lease_start_date: '',
  lease_end_date: '',
  rent_commencement_date: '',
  option_renewals: '',
  escalation_structure: '',
  cam_reimbursement: '',
  tax_reimbursement: '',
  insurance_reimbursement: '',
  percentage_rent: '',
  security_deposit: '',
  guarantor: '',
  tenant_credit_rating: '',
  tenant_industry: '',
  is_anchor: false,
  is_vacant: false,
  market_rent_estimate: '',
  notes: '',
  status: 'Active',
};

function leaseToForm(lease: TerminalTenantLease): TenantFormState {
  return {
    tenant_name: lease.tenant_name ?? '',
    address_id: lease.address_id ?? '',
    suite_unit: lease.suite_unit ?? '',
    leased_sf: lease.leased_sf != null ? String(lease.leased_sf) : '',
    annual_base_rent: lease.annual_base_rent ?? '',
    rent_per_sf: lease.rent_per_sf ?? '',
    lease_type: (lease.lease_type ?? 'NNN') as LeaseType,
    lease_start_date: toDateInputValue(lease.lease_start_date),
    lease_end_date: toDateInputValue(lease.lease_end_date),
    rent_commencement_date: toDateInputValue(lease.rent_commencement_date),
    option_renewals: lease.option_renewals ?? '',
    escalation_structure: lease.escalation_structure ?? '',
    cam_reimbursement: lease.cam_reimbursement ?? '',
    tax_reimbursement: lease.tax_reimbursement ?? '',
    insurance_reimbursement: lease.insurance_reimbursement ?? '',
    percentage_rent: lease.percentage_rent ?? '',
    security_deposit: lease.security_deposit ?? '',
    guarantor: lease.guarantor ?? '',
    tenant_credit_rating: lease.tenant_credit_rating ?? '',
    tenant_industry: lease.tenant_industry ?? '',
    is_anchor: !!lease.is_anchor,
    is_vacant: !!lease.is_vacant,
    market_rent_estimate: lease.market_rent_estimate ?? '',
    notes: lease.notes ?? '',
    status: (lease.status ?? 'Active') as LeaseStatus,
  };
}

function formToDb(form: TenantFormState, dealId: string, sortOrder: number) {
  // Tolerate unknown input types — Supabase can return NUMERIC columns as
  // either strings or numbers depending on the server/client version, and
  // auto-computed fields (rent_per_sf) may land here as either.
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    const n = parseFloat(s.replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const int = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
    const s = String(v).trim();
    if (!s) return null;
    const n = parseInt(s.replace(/[,\s]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };

  return {
    deal_id: dealId,
    address_id: form.address_id.trim() || null,
    tenant_name: form.is_vacant && !form.tenant_name.trim() ? 'Vacant' : form.tenant_name.trim(),
    suite_unit: form.suite_unit.trim() || null,
    leased_sf: int(form.leased_sf),
    annual_base_rent: form.is_vacant ? null : num(form.annual_base_rent),
    rent_per_sf: form.is_vacant ? null : num(form.rent_per_sf),
    lease_type: form.is_vacant ? null : form.lease_type,
    lease_start_date: form.is_vacant ? null : form.lease_start_date || null,
    lease_end_date: form.is_vacant ? null : form.lease_end_date || null,
    rent_commencement_date: form.is_vacant ? null : form.rent_commencement_date || null,
    option_renewals: form.is_vacant ? null : form.option_renewals.trim() || null,
    escalation_structure: form.is_vacant ? null : form.escalation_structure.trim() || null,
    cam_reimbursement: num(form.cam_reimbursement),
    tax_reimbursement: num(form.tax_reimbursement),
    insurance_reimbursement: num(form.insurance_reimbursement),
    percentage_rent: form.percentage_rent.trim() || null,
    security_deposit: num(form.security_deposit),
    guarantor: form.guarantor.trim() || null,
    tenant_credit_rating: form.tenant_credit_rating.trim() || null,
    tenant_industry: form.tenant_industry.trim() || null,
    is_anchor: !!form.is_anchor,
    is_vacant: !!form.is_vacant,
    market_rent_estimate: form.is_vacant ? num(form.market_rent_estimate) : null,
    notes: form.notes.trim() || null,
    status: form.is_vacant ? 'Active' : form.status,
    sort_order: sortOrder,
  };
}

export default function RentRollAdminPage() {
  const params = useParams();
  const dealId = params.id as string;
  const locale = (params.locale as string) ?? 'en';
  const supabase = createClient();

  const [dealName, setDealName] = useState('');
  const [dealTotalSf, setDealTotalSf] = useState<number | null>(null);
  const [isPortfolio, setIsPortfolio] = useState(false);
  const [addresses, setAddresses] = useState<TerminalDealAddress[]>([]);
  const [leases, setLeases] = useState<TerminalTenantLease[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TenantFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TerminalTenantLease | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [extractingFor, setExtractingFor] = useState<string | null>(null); // addressId or 'deal'
  const [extractMessage, setExtractMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [dealRes, leasesRes, addressesRes] = await Promise.all([
      supabase.from('terminal_deals').select('name, square_footage, is_portfolio').eq('id', dealId).single(),
      supabase
        .from('tenant_leases')
        .select('*')
        .eq('deal_id', dealId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('terminal_deal_addresses')
        .select('*')
        .eq('deal_id', dealId)
        .order('display_order', { ascending: true }),
    ]);
    if (dealRes.data) {
      setDealName(dealRes.data.name as string);
      const sfRaw = (dealRes.data.square_footage as string | null) ?? '';
      const sfNum = parseFloat(sfRaw.replace(/,/g, ''));
      setDealTotalSf(Number.isFinite(sfNum) && sfNum > 0 ? sfNum : null);
      setIsPortfolio(!!dealRes.data.is_portfolio);
    }
    if (leasesRes.data) setLeases(leasesRes.data as TerminalTenantLease[]);
    if (addressesRes.data) setAddresses(addressesRes.data as TerminalDealAddress[]);
    setLoading(false);
  }, [dealId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cache WALT on the deal whenever leases change.
  async function recomputeAndCacheWALT(updated: TerminalTenantLease[]) {
    const walt = computeWALT(updated);
    await supabase
      .from('terminal_deals')
      .update({ computed_walt: walt !== null ? walt.toFixed(2) : null })
      .eq('id', dealId);
  }

  function openAdd(vacant = false, presetAddressId?: string) {
    setEditingId(null);
    const defaultAddressId = isPortfolio
      ? (presetAddressId ?? addresses[0]?.id ?? '')
      : '';
    setForm({
      ...EMPTY_FORM,
      is_vacant: vacant,
      tenant_name: vacant ? 'Vacant' : '',
      address_id: defaultAddressId,
    });
    setShowModal(true);
  }

  function openEdit(lease: TerminalTenantLease) {
    setEditingId(lease.id);
    setForm(leaseToForm(lease));
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  // Auto-compute rent/SF when leased_sf and annual_base_rent are both present.
  function updateFormField<K extends keyof TenantFormState>(key: K, value: TenantFormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'annual_base_rent' || key === 'leased_sf') {
        const sf = parseFloat(String(next.leased_sf).replace(/[,\s]/g, ''));
        const rent = parseFloat(String(next.annual_base_rent).replace(/[$,\s]/g, ''));
        if (Number.isFinite(sf) && sf > 0 && Number.isFinite(rent) && rent > 0) {
          next.rent_per_sf = (rent / sf).toFixed(2);
        }
      }
      return next;
    });
  }

  async function handleSave() {
    if (!form.is_vacant && !form.tenant_name.trim()) {
      alert('Tenant name is required');
      return;
    }
    if (isPortfolio && !form.address_id) {
      alert('Please select a building for this tenant.');
      return;
    }
    setSaving(true);

    try {
      if (editingId) {
        const existing = leases.find((l) => l.id === editingId);
        const sortOrder = existing?.sort_order ?? 0;
        const payload = formToDb(form, dealId, sortOrder);
        const { data, error } = await supabase
          .from('tenant_leases')
          .update(payload)
          .eq('id', editingId)
          .select()
          .maybeSingle();
        if (error) {
          alert(`Failed to save: ${error.message}`);
        } else if (data) {
          const updated = leases.map((l) => (l.id === editingId ? (data as TerminalTenantLease) : l));
          setLeases(updated);
          // Cache-refresh is best-effort — do not let a failure hang the save.
          recomputeAndCacheWALT(updated).catch((e) => console.warn('cache walt failed', e));
          closeModal();
        } else {
          // UPDATE succeeded server-side but RETURNING read was blocked or
          // zero-match. Refetch so the UI reflects the committed row.
          await fetchData();
          closeModal();
        }
      } else {
        const nextOrder = leases.length > 0 ? Math.max(...leases.map((l) => l.sort_order)) + 1 : 0;
        const payload = formToDb(form, dealId, nextOrder);
        const { data, error } = await supabase
          .from('tenant_leases')
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) {
          alert(`Failed to save: ${error.message}`);
        } else if (data) {
          const updated = [...leases, data as TerminalTenantLease];
          setLeases(updated);
          recomputeAndCacheWALT(updated).catch((e) => console.warn('cache walt failed', e));
          closeModal();
        } else {
          await fetchData();
          closeModal();
        }
      }
    } catch (e) {
      console.error('tenant save failed', e);
      alert(`Failed to save: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('tenant_leases').delete().eq('id', deleteTarget.id);
      if (error) {
        alert(`Failed to delete: ${error.message}`);
      } else {
        const updated = leases.filter((l) => l.id !== deleteTarget.id);
        setLeases(updated);
        recomputeAndCacheWALT(updated).catch((e) => console.warn('cache walt failed', e));
        setDeleteTarget(null);
      }
    } catch (e) {
      console.error('tenant delete failed', e);
      alert(`Failed to delete: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setDeleting(false);
    }
  }

  async function handleReorder(id: string, direction: 'up' | 'down') {
    const ordered = sortTenantsForDisplay(leases);
    const idx = ordered.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;

    const a = ordered[idx];
    const b = ordered[swapIdx];
    const aOrder = a.sort_order;
    const bOrder = b.sort_order;

    await Promise.all([
      supabase.from('tenant_leases').update({ sort_order: bOrder }).eq('id', a.id),
      supabase.from('tenant_leases').update({ sort_order: aOrder }).eq('id', b.id),
    ]);

    setLeases((prev) =>
      prev.map((l) => {
        if (l.id === a.id) return { ...l, sort_order: bOrder };
        if (l.id === b.id) return { ...l, sort_order: aOrder };
        return l;
      }),
    );
  }

  async function handleExtractFromOM(addressId?: string) {
    // For single-property deals pass no addressId. For portfolios pass the
    // building the admin picked; the API will pick that building's OM (or
    // fall back to the deal-level OM with the building's label as context).
    // Serialize: only one extraction at a time (buttons are also disabled
    // client-side, but this guards against stale clicks slipping through).
    if (extractingFor !== null) return;
    const key = addressId ?? 'deal';
    setExtractingFor(key);
    setExtractMessage(null);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}/extract-tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId: addressId ?? null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setExtractMessage(`Extraction failed: ${json.error ?? 'unknown error'}`);
      } else {
        const label = addresses.find((a) => a.id === addressId)?.label;
        setExtractMessage(
          `Extracted ${json.inserted ?? 0} tenant record(s)${label ? ` for ${label}` : ''}. Please review each row before publishing.`,
        );
        await fetchData();
      }
    } catch (err) {
      setExtractMessage(`Extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setExtractingFor(null);
    }
  }

  const sortedLeases = sortTenantsForDisplay(leases);
  const walt = computeWALT(leases);
  const { occupancyPct } = computeOccupancy(leases, dealTotalSf);
  const totalRent = computeTotalRent(leases);

  // Portfolio: present tenants in buckets by address, with a trailing
  // bucket for orphan rows (address_id NULL — typically unmatched AI extractions).
  interface Bucket {
    key: string;
    label: string;
    addressId: string | null;
    tenantsInBucket: TerminalTenantLease[];
  }
  const buckets: Bucket[] = isPortfolio
    ? [
        ...addresses.map((addr) => ({
          key: addr.id,
          label: addr.label,
          addressId: addr.id,
          tenantsInBucket: sortedLeases.filter((l) => l.address_id === addr.id),
        })),
        {
          key: 'unassigned',
          label: 'Unassigned / Needs Review',
          addressId: null,
          tenantsInBucket: sortedLeases.filter((l) => !l.address_id),
        },
      ].filter((b) => b.addressId !== null || b.tenantsInBucket.length > 0)
    : [
        {
          key: 'all',
          label: '',
          addressId: null,
          tenantsInBucket: sortedLeases,
        },
      ];

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1400px] mx-auto">
      <DealSubNav dealId={dealId} dealName={dealName} locale={locale} />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Tenants" value={leases.filter((l) => !l.is_vacant).length.toString()} />
        <SummaryCard label="WALT" value={formatYears(walt)} />
        <SummaryCard label="Occupancy" value={occupancyPct !== null ? `${occupancyPct.toFixed(1)}%` : '—'} />
        <SummaryCard label="Total Annual Rent" value={formatMoney(totalRent)} />
      </div>

      <div className="bg-white rounded-2xl border border-rp-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-semibold text-rp-navy">Rent Roll</h2>
            <p className="text-[12px] text-rp-gray-500 mt-1">
              Informational only — does not affect cap rate, CoC, IRR, DSCR, or equity.
              {isPortfolio && ' Portfolio — rent rolls are grouped by building.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isPortfolio && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleExtractFromOM()}
                loading={extractingFor === 'deal'}
                disabled={extractingFor !== null && extractingFor !== 'deal'}
              >
                Auto-extract from OM
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => openAdd(true)}>
              + Vacant Space
            </Button>
            <Button variant="gold" size="sm" onClick={() => openAdd(false)}>
              + Add Tenant
            </Button>
          </div>
        </div>

        {extractMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rp-gold/10 border border-rp-gold/30 text-[12px] text-rp-navy">
            {extractMessage}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-rp-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedLeases.length === 0 && !isPortfolio ? (
          <div className="text-center py-14 text-rp-gray-400">
            <p className="text-sm font-medium">No tenants added yet.</p>
            <p className="text-xs mt-1">Click &ldquo;Add Tenant&rdquo; or run Auto-extract from OM.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {buckets.map((bucket) => {
              const bucketWalt = computeWALT(bucket.tenantsInBucket);
              const bucketRent = computeTotalRent(bucket.tenantsInBucket);
              const bucketSfDenominator = (() => {
                const addr = addresses.find((a) => a.id === bucket.addressId);
                const rawSf = addr?.square_footage ?? '';
                const n = parseFloat(rawSf.replace(/,/g, ''));
                return Number.isFinite(n) && n > 0 ? n : null;
              })();
              const bucketOcc = computeOccupancy(bucket.tenantsInBucket, bucketSfDenominator);
              const isExtracting = extractingFor === (bucket.addressId ?? 'deal');

              return (
                <div key={bucket.key}>
                  {isPortfolio && (
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-rp-gray-200">
                      <div className="flex items-baseline gap-4 flex-wrap">
                        <h3 className="text-[14px] font-semibold text-rp-navy">
                          {bucket.label}
                          {bucket.addressId === null && (
                            <span className="ml-2 text-[11px] font-medium text-rp-red">
                              ({bucket.tenantsInBucket.length} needs building assignment)
                            </span>
                          )}
                        </h3>
                        <span className="text-[11px] text-rp-gray-500">
                          WALT {formatYears(bucketWalt)} ·
                          {' '}Occupancy {bucketOcc.occupancyPct !== null ? `${bucketOcc.occupancyPct.toFixed(1)}%` : '—'} ·
                          {' '}Rent {formatMoney(bucketRent)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {bucket.addressId && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleExtractFromOM(bucket.addressId as string)}
                            loading={isExtracting}
                            disabled={extractingFor !== null && !isExtracting}
                          >
                            Auto-extract from this property&apos;s OM
                          </Button>
                        )}
                        {bucket.addressId && (
                          <Button
                            variant="gold"
                            size="sm"
                            onClick={() => openAdd(false, bucket.addressId as string)}
                          >
                            + Tenant
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {bucket.tenantsInBucket.length === 0 ? (
                    <div className="text-center py-8 text-rp-gray-400 text-[12px]">
                      No tenants for this building yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wide text-rp-gray-500 border-b border-rp-gray-200">
                            <th className="py-2 pr-3 w-14">Order</th>
                            <th className="py-2 pr-3">Tenant</th>
                            <th className="py-2 pr-3">Suite</th>
                            <th className="py-2 pr-3 text-right">SF</th>
                            <th className="py-2 pr-3 text-right">Rent/SF</th>
                            <th className="py-2 pr-3 text-right">Annual Rent</th>
                            <th className="py-2 pr-3">Type</th>
                            <th className="py-2 pr-3">Lease End</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2 pr-3 w-28 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bucket.tenantsInBucket.map((lease) => {
                            // Global indices for reorder bounds
                            const globalIdx = sortedLeases.findIndex((l) => l.id === lease.id);
                            return (
                              <tr
                                key={lease.id}
                                className={`border-b border-rp-gray-100 ${lease.is_vacant ? 'bg-rp-gray-50 text-rp-gray-400' : ''}`}
                              >
                                <td className="py-2 pr-3">
                                  <div className="flex flex-col">
                                    <button
                                      onClick={() => handleReorder(lease.id, 'up')}
                                      disabled={globalIdx === 0}
                                      className="text-rp-gray-400 hover:text-rp-navy disabled:opacity-20 text-xs"
                                      aria-label="Move up"
                                    >
                                      ▲
                                    </button>
                                    <button
                                      onClick={() => handleReorder(lease.id, 'down')}
                                      disabled={globalIdx === sortedLeases.length - 1}
                                      className="text-rp-gray-400 hover:text-rp-navy disabled:opacity-20 text-xs"
                                      aria-label="Move down"
                                    >
                                      ▼
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2 pr-3 font-medium text-rp-navy">
                                  {lease.is_anchor && <span className="text-rp-gold mr-1">★</span>}
                                  {lease.is_vacant ? <em>Vacant</em> : lease.tenant_name}
                                  {lease.ai_extracted && (
                                    <span className="ml-2 inline-block text-[9px] font-semibold uppercase tracking-wider text-rp-gold bg-rp-gold/10 px-1.5 py-0.5 rounded">
                                      AI
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 pr-3">{lease.suite_unit ?? '—'}</td>
                                <td className="py-2 pr-3 text-right">
                                  {lease.leased_sf ? lease.leased_sf.toLocaleString() : '—'}
                                </td>
                                <td className="py-2 pr-3 text-right">
                                  {lease.is_vacant ? '—' : formatRentPerSf(lease.rent_per_sf)}
                                </td>
                                <td className="py-2 pr-3 text-right">
                                  {lease.is_vacant ? '—' : formatMoney(lease.annual_base_rent)}
                                </td>
                                <td className="py-2 pr-3">{lease.is_vacant ? '—' : lease.lease_type}</td>
                                <td className="py-2 pr-3">{lease.is_vacant ? '—' : lease.lease_end_date ?? '—'}</td>
                                <td className="py-2 pr-3">
                                  {lease.is_vacant ? 'Vacant' : lease.status}
                                </td>
                                <td className="py-2 pr-3 text-right">
                                  <button
                                    onClick={() => openEdit(lease)}
                                    className="text-rp-navy hover:underline text-xs font-medium"
                                  >
                                    Edit
                                  </button>
                                  <span className="mx-1 text-rp-gray-300">·</span>
                                  <button
                                    onClick={() => setDeleteTarget(lease)}
                                    className="text-rp-red hover:underline text-xs font-medium"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit/Add modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={closeModal}
          title={editingId ? 'Edit Tenant' : form.is_vacant ? 'Add Vacant Space' : 'Add Tenant'}
        >
          <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-3">
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={form.is_vacant}
                onChange={(e) => updateFormField('is_vacant', e.target.checked)}
                className="w-4 h-4 rounded border-rp-gold focus:ring-rp-gold"
              />
              Mark as vacant space
            </label>

            {isPortfolio && (
              <div>
                <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">
                  Building *
                </label>
                <select
                  value={form.address_id}
                  onChange={(e) => updateFormField('address_id', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
                >
                  <option value="">Select a building…</option>
                  {addresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.label}
                      {addr.address ? ` — ${addr.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!form.is_vacant && (
              <Input
                label="Tenant Name *"
                value={form.tenant_name}
                onChange={(e) => updateFormField('tenant_name', e.target.value)}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Suite / Unit"
                value={form.suite_unit}
                onChange={(e) => updateFormField('suite_unit', e.target.value)}
              />
              <Input
                label="Leased SF"
                value={form.leased_sf}
                onChange={(e) => updateFormField('leased_sf', e.target.value)}
                placeholder="e.g. 25000"
              />
            </div>

            {!form.is_vacant && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Annual Base Rent"
                    value={form.annual_base_rent}
                    onChange={(e) => updateFormField('annual_base_rent', e.target.value)}
                    placeholder="e.g. 162500"
                  />
                  <Input
                    label="Rent / SF (auto)"
                    value={form.rent_per_sf}
                    onChange={(e) => updateFormField('rent_per_sf', e.target.value)}
                    placeholder="auto-computed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Lease Type"
                    value={form.lease_type}
                    onChange={(v) => updateFormField('lease_type', v as LeaseType)}
                    options={LEASE_TYPES}
                  />
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(v) => updateFormField('status', v as LeaseStatus)}
                    options={LEASE_STATUSES}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Lease Start"
                    type="date"
                    value={form.lease_start_date}
                    onChange={(e) => updateFormField('lease_start_date', e.target.value)}
                  />
                  <Input
                    label="Lease End *"
                    type="date"
                    value={form.lease_end_date}
                    onChange={(e) => updateFormField('lease_end_date', e.target.value)}
                  />
                </div>
                <Input
                  label="Rent Commencement"
                  type="date"
                  value={form.rent_commencement_date}
                  onChange={(e) => updateFormField('rent_commencement_date', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Option Renewals"
                    value={form.option_renewals}
                    onChange={(e) => updateFormField('option_renewals', e.target.value)}
                    placeholder="e.g. 2x5yr"
                  />
                  <Input
                    label="Escalation Structure"
                    value={form.escalation_structure}
                    onChange={(e) => updateFormField('escalation_structure', e.target.value)}
                    placeholder="e.g. 2% annual"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="CAM Reimb $"
                    value={form.cam_reimbursement}
                    onChange={(e) => updateFormField('cam_reimbursement', e.target.value)}
                  />
                  <Input
                    label="Tax Reimb $"
                    value={form.tax_reimbursement}
                    onChange={(e) => updateFormField('tax_reimbursement', e.target.value)}
                  />
                  <Input
                    label="Insurance Reimb $"
                    value={form.insurance_reimbursement}
                    onChange={(e) => updateFormField('insurance_reimbursement', e.target.value)}
                  />
                </div>
                <Input
                  label="Percentage Rent"
                  value={form.percentage_rent}
                  onChange={(e) => updateFormField('percentage_rent', e.target.value)}
                  placeholder="e.g. 5% above $2M breakpoint"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Security Deposit"
                    value={form.security_deposit}
                    onChange={(e) => updateFormField('security_deposit', e.target.value)}
                  />
                  <Input
                    label="Guarantor"
                    value={form.guarantor}
                    onChange={(e) => updateFormField('guarantor', e.target.value)}
                    placeholder="Corporate / Personal / None"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Credit Rating"
                    value={form.tenant_credit_rating || ''}
                    onChange={(v) => updateFormField('tenant_credit_rating', v)}
                    options={['', ...CREDIT_RATINGS]}
                    labels={['Unspecified', ...CREDIT_RATINGS]}
                  />
                  <Input
                    label="Industry"
                    value={form.tenant_industry}
                    onChange={(e) => updateFormField('tenant_industry', e.target.value)}
                    placeholder="e.g. Grocery, Medical"
                  />
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={form.is_anchor}
                    onChange={(e) => updateFormField('is_anchor', e.target.checked)}
                    className="w-4 h-4 rounded border-rp-gray-300 text-rp-gold focus:ring-rp-gold"
                  />
                  Anchor tenant
                </label>
              </>
            )}

            {form.is_vacant && (
              <Input
                label="Market Rent Estimate ($/SF)"
                value={form.market_rent_estimate}
                onChange={(e) => updateFormField('market_rent_estimate', e.target.value)}
                placeholder="e.g. 18.00"
              />
            )}

            <div>
              <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateFormField('notes', e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button variant="ghost" size="sm" onClick={closeModal}>
              Cancel
            </Button>
            <Button variant="gold" size="sm" onClick={handleSave} loading={saving}>
              {editingId ? 'Save Changes' : 'Add'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Tenant"
        >
          <p className="text-sm text-rp-gray-600 mb-6">
            Remove &ldquo;{deleteTarget.tenant_name}&rdquo; from the rent roll? This cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-rp-gray-200 p-4">
      <div className="text-[10px] font-semibold tracking-wider uppercase text-rp-gray-500">{label}</div>
      <div className="mt-1 text-[18px] font-semibold text-rp-navy font-[family-name:var(--font-playfair)]">
        {value}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: string[];
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-rp-gray-700 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 border border-rp-gray-300 rounded-lg text-sm text-rp-gray-700 bg-white focus:outline-none focus:ring-[3px] focus:ring-rp-gold/15 focus:border-rp-gold"
      >
        {options.map((opt, i) => (
          <option key={opt} value={opt}>
            {labels?.[i] ?? opt}
          </option>
        ))}
      </select>
    </div>
  );
}
